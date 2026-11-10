import "./backToTop.css";

export default function BackToTop({ animate }: { animate: boolean }) {
  return (
    <div className="public-back-top">
      <button
        type="button"
        onClick={() => {
          const heading = document.querySelector<HTMLElement>("main.home h1");
          heading?.focus({ preventScroll: true });
          heading?.scrollIntoView({
            behavior: animate ? "smooth" : "auto",
            block: "start",
          });
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}features/back-to-top.svg`}
          alt=""
          width="20"
          height="20"
        />
        Back to top
      </button>
    </div>
  );
}
