import { Clock3, FolderOpen, HardDrive, Star, Trash2, Users } from "lucide-react";

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
		href: "/recent",
		label: "Recent",
		icon: Clock3,
		match: (pathname: string) => pathname.startsWith("/recent"),
	},
	{
		href: "/starred",
		label: "Starred",
		icon: Star,
		match: (pathname: string) => pathname.startsWith("/starred"),
	},
  {
		href: "/trash",
		label: "Trash",
		icon: Trash2,
		match: (pathname: string) => pathname.startsWith("/trash"),
	},
	{
    href: "/shared",
    label: "Shared",
    icon: Users,
    match: (pathname: string) => pathname.startsWith("/shared"),
  },
	{
		href: "/storage",
		label: "Storage",
		icon: HardDrive,
		match: (pathname: string) => pathname.startsWith("/storage"),
	},
];
