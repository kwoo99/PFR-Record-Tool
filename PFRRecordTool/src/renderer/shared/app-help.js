/** Opens the reusable Help window from any primary app workspace. */
(() => {
  const { CHANNELS } = window.api.comm;
  document.querySelectorAll("[data-open-help]").forEach((button) => {
    button.addEventListener("click", () => {
      window.api.comm.invoke(CHANNELS.OPEN_HELP).catch(() => {});
    });
  });
})();
