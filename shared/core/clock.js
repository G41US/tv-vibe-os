/*
 * Greeting, clock and date text, matching TV Home ("GOOD EVENING", "5:02 PM", "SUNDAY 18 OCTOBER").
 * Greeting thresholds are the same as MainActivity.updateGreeting().
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; root.TVV.clock = mod; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"];

  function greeting(hour) {
    if (hour < 5) return "Good night";
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 22) return "Good evening";
    return "Good night";
  }

  function two(n) { return n < 10 ? "0" + n : String(n); }

  /** {time, suffix}: "5:02" + "PM" in 12-hour mode, "17:02" + "" in 24-hour mode. */
  function time(date, use24) {
    var h = date.getHours(), m = date.getMinutes();
    if (use24) return { time: two(h) + ":" + two(m), suffix: "" };
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return { time: h12 + ":" + two(m), suffix: h < 12 ? "AM" : "PM" };
  }

  /** "Sunday 18 October", localised through Intl when the locale is not English and Intl exists. */
  function dateLine(date, locale) {
    if (locale && !/^en\b/i.test(locale) && typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      try {
        return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(date);
      } catch (e) { /* fall through to English */ }
    }
    return DAYS[date.getDay()] + " " + date.getDate() + " " + MONTHS[date.getMonth()];
  }

  /** Guesses 12/24-hour from the locale when the user has not chosen (null). */
  function prefers24(locale) {
    if (typeof Intl === "undefined" || !Intl.DateTimeFormat) return false;
    try {
      var parts = new Intl.DateTimeFormat(locale || undefined, { hour: "numeric" }).format(new Date(2020, 0, 1, 15));
      return !/[AaPp]\.?\s?[Mm]/.test(parts) && /15/.test(parts);
    } catch (e) { return false; }
  }

  /** Milliseconds until the next minute boundary, so the clock flips on time. */
  function msToNextMinute(date) {
    return (60 - date.getSeconds()) * 1000 - date.getMilliseconds();
  }

  return { greeting: greeting, time: time, dateLine: dateLine, prefers24: prefers24, msToNextMinute: msToNextMinute };
});
