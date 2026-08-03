export const formatMessageTime = (value: number | string): string => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart}, ${timePart}`;
};
