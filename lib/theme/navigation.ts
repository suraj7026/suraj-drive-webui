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
    label: "my archive",
    icon: FolderOpen,
    match: (pathname: string) => pathname.startsWith("/archive"),
  },
	{
		href: "/recent",
		label: "recent",
		icon: Clock3,
		match: (pathname: string) => pathname.startsWith("/recent"),
	},
	{
		href: "/starred",
		label: "starred",
		icon: Star,
		match: (pathname: string) => pathname.startsWith("/starred"),
	},
  {
		href: "/trash",
		label: "trash",
		icon: Trash2,
		match: (pathname: string) => pathname.startsWith("/trash"),
	},
	{
    href: "/shared",
    label: "shared",
    icon: Users,
    match: (pathname: string) => pathname.startsWith("/shared"),
  },
	{
		href: "/storage",
		label: "storage",
		icon: HardDrive,
		match: (pathname: string) => pathname.startsWith("/storage"),
	},
];
