import { FolderOpen, Users } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof FolderOpen;
  match: (pathname: string) => boolean;
  badge?: string;
};

export const navItems: NavItem[] = [
  {
    href: "/archive/my-archive",
    label: "My Archive",
    icon: FolderOpen,
    match: (pathname: string) => pathname.startsWith("/archive"),
  },
  {
    href: "/shared",
    label: "Shared",
    icon: Users,
    match: (pathname: string) => pathname.startsWith("/shared"),
  },
];
