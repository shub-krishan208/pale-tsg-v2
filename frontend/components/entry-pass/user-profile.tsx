import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "./utils";
import type { EntryPassUser } from "./types";

type UserProfileProps = {
    user: EntryPassUser;
};

export function UserProfile({ user }: UserProfileProps) {
    return (
        <section className="mt-3 flex items-center gap-3">
            <Avatar className="size-12 ring-2 ring-white/10">
                <AvatarFallback className="bg-white/15 text-white">
                    {initials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="truncate text-lg font-semibold leading-6">
                    {user.name ?? user.roll}
                </div>
                {user.department ? (
                    <div className="truncate text-sm text-white/55">
                        {user.department}
                    </div>
                ) : null}
            </div>
        </section>
    );
}
