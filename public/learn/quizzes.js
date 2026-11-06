// Progressive enhancement only: no accounts, network calls, analytics or persistence.
const forms = [...globalThis.document.querySelectorAll('form[data-quiz]')];
for (const form of forms) {
  form.hidden = false;
  const feedback = form.querySelector('[role="status"]');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const chosen = form.querySelector('input:checked');
    if (!chosen) return;
    feedback.textContent = chosen.value === form.dataset.answer
      ? form.dataset.correct : form.dataset.retry;
  });
  form.addEventListener('change', () => { feedback.textContent = ''; });
  form.addEventListener('reset', () => { feedback.textContent = ''; });
}
// A return from browser history must not imply saved learning progress.
globalThis.addEventListener('pageshow', () => { for (const form of forms) form.reset(); });
globalThis.addEventListener('pagehide', () => { for (const form of forms) form.reset(); });
