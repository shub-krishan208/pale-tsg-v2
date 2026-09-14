import { EntryPassClient } from "@/components/entry-pass";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function Home() {
    return (
        <div className="min-h-dvh bg-linear-to-b from-[#0B2A57] via-[#082243] to-[#061A35] text-white flex flex-col justify-between">
            <EntryPassClient />
            <div className="py-4 text-center">
                <Link
                    href="/gate/"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-300/70 hover:text-blue-200 transition-colors px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10"
                >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Open Gate Monitor Screen</span>
                </Link>
            </div>
        </div>
    );
}
