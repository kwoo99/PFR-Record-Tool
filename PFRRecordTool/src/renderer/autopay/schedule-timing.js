/**
 * AutoPay schedule presentation.
 *
 * PayFabric processes a contract at midnight on NextPaymentDate in that
 * contract's portal time zone. These helpers preserve the selected calendar
 * date without converting it through the operator's computer time zone.
 */
(function initializeAutoPayScheduleTiming(root) {
  function dateParts(value) {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day)
    ) {
      return null;
    }
    return { date, day, month, year };
  }

  function formatProcessDay(value, locale = undefined) {
    const parsed = dateParts(value);
    if (!parsed) return "";

    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      weekday: "long",
      year: "numeric",
    }).format(parsed.date);
  }

  function dateInputValue(value) {
    return dateParts(value)
      ? String(value).match(/^\d{4}-\d{2}-\d{2}/)[0]
      : "";
  }

  function portalMidnightValue(value) {
    const date = dateInputValue(value);
    // No offset is intentional: PayFabric interprets this in the portal zone.
    return date ? `${date}T00:00:00` : undefined;
  }

  function formatTimezone(timezone) {
    if (typeof timezone === "string") return timezone.trim();
    if (!timezone || Array.isArray(timezone) || typeof timezone !== "object") {
      return "";
    }
    const label = [
      timezone.displayName,
      timezone.DisplayName,
      timezone.name,
      timezone.Name,
    ].find((value) => typeof value === "string" && value.trim());
    return label ? label.trim() : "";
  }

  function describeProcessDay(value, { bulk = false, timezone = null } = {}) {
    const processDay = formatProcessDay(value);
    const timezoneName = formatTimezone(timezone);
    const timezonePhrase = timezoneName
      ? timezoneName
      : bulk
        ? "its PayFabric portal time zone"
        : "the contract's PayFabric portal time zone";
    if (!processDay) {
      return {
        detail: bulk
          ? `Each contract starts at 12:00 AM (00:00) in ${timezonePhrase} on the date supplied by its selected source.`
          : `Choose a date to preview the midnight start in ${timezonePhrase}.`,
        headline: bulk ? "No date override selected" : "No process day selected",
      };
    }

    return {
      detail: `Starts at 12:00 AM (00:00) in ${timezonePhrase}.`,
      headline: `${bulk ? "Scheduled start override" : "Scheduled start"}: ${processDay}`,
    };
  }

  const publicAPI = {
    dateInputValue,
    describeProcessDay,
    formatProcessDay,
    formatTimezone,
    portalMidnightValue,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicAPI;
  }
  if (root) root.autoPayScheduleTiming = publicAPI;
})(typeof window === "undefined" ? null : window);
