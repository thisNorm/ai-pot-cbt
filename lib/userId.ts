export function getUserId() {
  if (typeof window === "undefined") return "server";
  const key = "ai_pot_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
