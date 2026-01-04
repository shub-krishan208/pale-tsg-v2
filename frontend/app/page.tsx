import {
    ToastProvider,
    UserProfile,
    AssetDeclarationForm,
    type EntryPassUser,
} from "@/components/entry-pass";

// This would come from server-side data fetching in the future
function getUser(): EntryPassUser {
    return {
        roll: "24MA10063",
        // name and department can be fetched from backend
    };
}

export default function Home() {
    const user = getUser();

    return (
        <div className="min-h-dvh bg-linear-to-b from-[#0B2A57] via-[#082243] to-[#061A35] text-white">
            <ToastProvider>
                <div className="mx-auto w-full max-w-sm px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
                    {/* Top bar */}
                    <header className="relative flex items-center justify-center py-3">
                        <h1 className="text-base font-semibold tracking-tight">
                            Library Entry Pass
                        </h1>
                    </header>

                    {/* Profile */}
                    <UserProfile user={user} />

                    {/* Asset Declaration Form */}
                    <AssetDeclarationForm />
                </div>
            </ToastProvider>
        </div>
    );
}
