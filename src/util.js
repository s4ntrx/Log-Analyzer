const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export const esc = value => String(value).replace(/[&<>"]/g, char => HTML_ESCAPES[char]);

export const formatTime = date =>
  date ? date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
