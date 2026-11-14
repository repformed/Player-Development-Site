import { boundedReviewRpc } from "./reviewRpc";
import { trackUpload, type UploadProgress } from "./uploadProgress";
import { serviceSchema } from "./reviewServices";
import { groupSchema } from "./reviewGroups";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrivatePlayer } from "./accounts";
export const VIDEO_LIMIT = 40 * 1024 * 1024;
export const reviewSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  account_id: z.string().uuid(),
  submitted_by: z.string().uuid(),
  resource_id: z.string().uuid().nullable(),
  drill_title: z.string(),
  asset_path: z.string(),
  media_type: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
  byte_size: z.number(),
  duration_seconds: z.coerce.number(),
  status: z.enum(["uploading", "pending_parent", "queued", "reviewed"]),
  feedback: z.string(),
  created_at: z.string(),
  version: z.number().int().positive(),
  review_request_id: z.string().uuid().nullable().optional(),
  clip_ordinal: z.number().int().nullable().optional(),
});
export type VideoReview = z.infer<typeof reviewSchema>;
export const videoStateSchema = z.object({
  grouped_reviews_ready: z.boolean().default(false),
  groups: z.array(z.lazy(() => groupSchema)).default([]),
  service_tracking: z.boolean().default(false),
  services: z.array(serviceSchema).default([]),
  can_submit: z.boolean(),
  adult_only: z.boolean(),
  // Legacy API name: stored clip/reservation capacity, never monthly review credits.
  remaining_slots: z.number().int().nonnegative().default(5),
  reviews: z.array(reviewSchema),
});
export type VideoState = z.infer<typeof videoStateSchema>;
export const REVIEW_STATUS: Record<VideoReview["status"], string> = {
  uploading: "Upload unfinished",
  pending_parent: "Parent approval needed",
  queued: "Sent for coach review",
  reviewed: "Coach feedback ready",
};
export function videoFileError(file: File) {
  if (!file.size || file.size > VIDEO_LIMIT)
    return "Choose a video smaller than 40 MB.";
  if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type))
    return "Choose an MP4, MOV or WebM video.";
  return "";
}
export async function inspectVideo(file: File): Promise<number> {
  const error = videoFileError(file);
  if (error) throw new Error(error);
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mp4 = String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  const webm = [0x1a, 0x45, 0xdf, 0xa3].every((b, i) => bytes[i] === b);
  if (file.type === "video/webm" ? !webm : !mp4)
    throw new Error("This file does not appear to be a supported video.");
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (duration?: number) => {
      if (done) return;
      done = true;
      video.onloadedmetadata = null;
      video.onerror = null;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if (duration && Number.isFinite(duration) && duration <= 60)
        resolve(duration);
      else
        reject(
          new Error(
            "Choose a playable video up to 60 seconds long. Shorten it in Photos if needed.",
          ),
        );
    };
    const timer = setTimeout(() => finish(), 15000);
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish();
    video.src = url;
  });
}
export class VideoReviews {
  constructor(readonly client: SupabaseClient) {}
  async state(player: PrivatePlayer) {
    const { data, error } = await boundedReviewRpc(signal => this.client.rpc("athlete_video_state", {
      target_profile: player.id,
    }).abortSignal(signal), true);
    if (error)
      throw new Error("Video review could not be loaded. Reconnect and retry.");
    return videoStateSchema.parse(data);
  }
  async send(
    id: string,
    player: PrivatePlayer,
    trainingId: string,
    file: File,
    seconds: number,
    progress?: (value: UploadProgress) => void,
  ) {
    const problem = videoFileError(file);
    if (problem) throw new Error(problem);
    const { data, error } = await boundedReviewRpc(signal => this.client.rpc("begin_athlete_video", {
      review_id: id,
      target_profile: player.id,
      training_id: trainingId,
      media_type: file.type,
      byte_size: file.size,
      duration_seconds: seconds,
    }).abortSignal(signal));
    if (error)
      throw new Error(
        error.message.startsWith("Video storage is full.")
          ? "Video storage is full. Delete an older clip and retry."
          : "Review access could not be confirmed. Your video has not been sent.",
      );
    const draft = reviewSchema.parse(data);
    return this.sendReserved(draft, file, seconds, progress);
  }
  async sendReserved(
    draft: VideoReview,
    file: File,
    seconds: number,
    progress?: (value: UploadProgress) => void,
  ) {
    const problem = videoFileError(file);
    if (problem) throw new Error(problem);
    if (
      file.size !== draft.byte_size ||
      file.type !== draft.media_type ||
      Math.abs(seconds - draft.duration_seconds) > 0.05
    )
      throw new Error(
        "Choose the same clip reserved for this position, or delete the unfinished review and start again.",
      );
    if (draft.status !== "uploading") return draft;
    // Stable IDs make a lost upload/finalize response safe to retry. Never overwrite a clip.
    const uploaded = await trackUpload(
      `athlete-review-videos/${draft.asset_path}`,
      progress,
      () =>
        this.client.storage
          .from("athlete-review-videos")
          .upload(draft.asset_path, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "0",
          }),
    );
    const finished = await boundedReviewRpc(signal => this.client.rpc("finish_athlete_video", {
      review_id: draft.id,
    }).abortSignal(signal));
    if (finished.error)
      throw new Error(
        uploaded.error
          ? "Upload was not confirmed. Keep this video selected and retry, or cancel to remove the unfinished submission."
          : "Video uploaded, but sending was not confirmed. Retry this same video or check your history.",
      );
    return reviewSchema.parse(finished.data);
  }
  async url(review: VideoReview) {
    const { data, error } = await this.client.storage
      .from("athlete-review-videos")
      .createSignedUrl(review.asset_path, 60);
    if (error || !data?.signedUrl)
      throw new Error(
        "Video access expired or is unavailable. Reopen the video to retry.",
      );
    return data.signedUrl;
  }
  async remove(review: Pick<VideoReview, "id" | "asset_path">) {
    const removed = await this.client.storage
      .from("athlete-review-videos")
      .remove([review.asset_path]);
    if (removed.error)
      throw new Error(
        "The stored video could not be removed. Reconnect and retry deletion.",
      );
    const { error } = await this.client.rpc("delete_athlete_video", {
      review_id: review.id,
    });
    if (error)
      throw new Error(
        "Video removed, but its record could not be cleared. Refresh and retry deletion.",
      );
  }
  async discard(id: string) {
    const { data, error } = await this.client
      .from("athlete_video_reviews")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error)
      throw new Error(
        "Could not check the unfinished upload. Reconnect and retry canceling.",
      );
    if (data) await this.remove(reviewSchema.parse(data));
  }
  async approve(review: VideoReview) {
    const { error } = await this.client.rpc("approve_athlete_video", {
      review_id: review.id,
      expected_version: review.version,
    });
    if (error)
      throw new Error("Approval was not confirmed. Refresh before retrying.");
  }
  async queue() {
    const { data, error } = await this.client
      .from("athlete_video_reviews")
      .select("*")
      .in("status", ["queued", "reviewed"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error)
      throw new Error("Your private review queue could not be loaded.");
    return z.array(reviewSchema).parse(data);
  }
  async start(review: VideoReview) {
    const { error } = await this.client.rpc("start_drill_review", {
      review_id: review.id,
      expected_version: review.version,
    });
    if (error)
      throw new Error(
        "This review changed or is already being reviewed. Refresh before opening it again.",
      );
  }
  async feedback(review: VideoReview, text: string) {
    const { error } = await this.client.rpc("save_athlete_video_feedback", {
      review_id: review.id,
      feedback_text: text.trim(),
      expected_version: review.version,
    });
    if (error)
      throw new Error(
        "Feedback was not confirmed, or this review changed. Refresh before retrying.",
      );
  }
}
