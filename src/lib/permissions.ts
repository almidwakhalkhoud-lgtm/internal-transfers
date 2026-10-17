export const menus = [
  "dashboard",
  "new-transfer",
  "transfers",
  "products",
  "locations",
] as const;
export type Menu = (typeof menus)[number];
export function hasMenu(user: { role: string; menus: string[] }, menu: string) {
  return user.role === "ADMIN" || user.menus.includes(menu);
}
export function landingPage(user: { role: string; menus: string[] }) {
  return user.role === "ADMIN"
    ? "/dashboard"
    : `/${menus.find((menu) => user.menus.includes(menu)) ?? "access"}`;
}
