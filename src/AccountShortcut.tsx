import { UserRound } from "lucide-react";
import "./accountShortcut.css";

export function AccountShortcut({ page }: { page: string }) {
  return (
    <a
      className="account-shortcut"
      href="#account"
      aria-label="Account settings"
      aria-current={page === "account" ? "page" : undefined}
      title="Account settings"
    >
      <UserRound size={21} aria-hidden="true" />
    </a>
  );
}
