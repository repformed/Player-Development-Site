import { CONTACT_EMAIL } from "./contactContent";

export const PACKAGE_PROPOSALS = [
  {
    id: "foundation",
    name: "Foundation",
    monthly: "9.99",
    annual: "99",
    annualSavings: "20.88",
    audience: "For athletes learning football basics",
    benefit: "Understand the game before adding drills.",
    comparison: {
      iq: "2 videos + 2 quizzes / week",
      movement: "No drills",
      positionDrills: "Not included",
      position: "Not included",
      reviews: "Not included",
    },
    focus: "Learn the game before the next rep.",
    cadence: "2 football-IQ videos + 2 lesson quizzes per week · no drills",
    includes: "Football learning, from the ground up",
    items: [
      "Two age-appropriate football-IQ videos each week, with a quiz for each lesson",
      "Rules, terminology, field markings and positions",
      "Introductory offense, defense and special teams",
      "Progress checklist, achievement badges, guardian dashboard and Foundation lesson library",
    ],
  },
  {
    id: "fundamentals",
    name: "Fundamentals",
    monthly: "19.99",
    annual: "199",
    annualSavings: "40.88",
    audience: "For athletes ready for guided practice",
    benefit: "Add two fundamental movement sessions each week.",
    comparison: {
      iq: "2 videos + 2 quizzes / week",
      movement: "2 movement sessions / week",
      positionDrills: "Not included",
      position: "Not included",
      reviews: "Not included",
    },
    focus: "Turn understanding into purposeful practice.",
    cadence: "2 IQ + 2 quizzes + 2 movement sessions per week",
    includes: "Everything proposed in Foundation, plus",
    items: [
      "Two fundamental movement training sessions each week",
      "Skill players: stance, starts, footwork, catching and ball security",
      "Linemen: stance, first step, leverage, hand placement and blocking movement",
      "Clear demonstrations, coaching cues, age-appropriate practice expectations and completed lesson/training progress",
    ],
  },
  {
    id: "position-development",
    name: "Position Development",
    monthly: "39.99",
    annual: "399",
    annualSavings: "80.88",
    audience: "For a focus on one selected position",
    benefit: "Add two position drills a week for one selected position.",
    comparison: {
      iq: "2 videos + 2 quizzes / week",
      movement: "2 movement sessions / week",
      positionDrills: "2 additional drills / week",
      position: "One selected position",
      reviews: "Not included",
    },
    focus: "Build a path around one selected position.",
    cadence:
      "2 IQ + 2 quizzes + 2 movement sessions + 2 position drills per week",
    includes: "Everything proposed in Fundamentals, plus",
    items: [
      "Two additional position-specific drills each week",
      "Guided selected-position pathway, responsibilities and position IQ",
      "Age/experience progressions, checkpoints and milestones",
    ],
    note: "The two position-specific drills are additional to the two movement sessions. Every level includes its lower-level benefits.",
  },
  {
    id: "elite-coaching",
    name: "Elite Coaching",
    monthly: "69.99",
    annual: "699",
    annualSavings: "140.88",
    audience: "For athletes seeking personalized corrections",
    benefit:
      "Add two athlete-chosen drill corrections per month, with next-step practice feedback.",
    comparison: {
      iq: "2 videos + 2 quizzes / week",
      movement: "2 movement sessions / week",
      positionDrills: "2 additional drills / week",
      position: "One selected position",
      reviews: "2 corrections / athlete / month",
    },
    focus: "Add a closer look at the work.",
    cadence:
      "Position Development + 2 personalized drill corrections per month",
    includes: "Everything proposed in Position Development, plus",
    items: [
      "Two personalized drill corrections per month for each subscribed Elite athlete; the athlete chooses the drills",
      "Up to three minutes of footage per submission",
      "Feedback identifying corrections and how to improve",
      "Next-step practice recommendations",
      "Guardian-visible feedback and improvement history",
    ],
    note: "Target turnaround: three business days, not guaranteed. Proposed review capacity and retention are being validated.",
  },
] as const;

export const PACKAGE_COMPARISON_ROWS = [
  { key: "iq", label: "Weekly football IQ" },
  { key: "movement", label: "Weekly movement training" },
  { key: "positionDrills", label: "Weekly position drills" },
  { key: "position", label: "Position pathway" },
  { key: "reviews", label: "Individual corrections" },
] as const;

export function packageInterestLink(id: string) {
  const chosen =
    PACKAGE_PROPOSALS.find((p) => p.id === id)?.name || "Not sure yet";
  const body = `I'm an adult interested in Repformed's proposed packages.\n\nInterested package: ${chosen}\nMy question or feedback: \nAdult contact name (optional): \n\nThis is an expression of interest, not enrollment, payment or a reservation.\nPlease do not include child names, dates of birth, videos or health details.`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Repformed proposed package interest")}&body=${encodeURIComponent(body)}`;
}
