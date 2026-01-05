"use client";

import * as React from "react";
import { Laptop, QrCode, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ItemList } from "./item-list";
import { QRDisplay, CompleteButton } from "./qr-display";
import { ConfirmationModal } from "./confirmation-modal";
import { ViewDetailsModal } from "./view-details-modal";
import { useToast } from "./toast-provider";
import { safeAutoCapitalize } from "./utils";
import type { ListItem, SessionData } from "./types";
import { apiCall } from "@/app/api";

type AssetDeclarationFormProps = {
    roll: string;
};

const STORAGE_KEY = "library-pass-form";
const TOKEN_KEY = "lib_pass_token";

type SavedFormData = {
    roll: string;
    laptopName: string;
    carryingDevice: boolean;
    personalBooks: ListItem[];
    extraGadgets: ListItem[];
};

export function AssetDeclarationForm({ roll }: AssetDeclarationFormProps) {
    const { toasts, addToast, removeToast, updateToast } = useToast();

    const [carryingDevice, setCarryingDevice] = React.useState(true);
    const [laptopName, setLaptopName] = React.useState("");
    const [personalBooks, setPersonalBooks] = React.useState<ListItem[]>([]);
    const [extraGadgets, setExtraGadgets] = React.useState<ListItem[]>([]);
    const [qrVisible, setQrVisible] = React.useState(false);
    const [showConfirmModal, setShowConfirmModal] = React.useState(false);
    const [showLastPass, setShowLastPass] = React.useState(false);
    const [hasSavedToken, setHasSavedToken] = React.useState(false);
    const [savedFormData, setSavedFormData] = React.useState<SavedFormData | null>(null);
    const [showDetailsModal, setShowDetailsModal] = React.useState(false);
    const lastPassQrRef = React.useRef<HTMLDivElement>(null);
    const newQrRef = React.useRef<HTMLDivElement>(null);

    // Scroll to QR when toggle is turned on
    React.useEffect(() => {
        if (showLastPass && lastPassQrRef.current) {
            setTimeout(() => {
                lastPassQrRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        }
    }, [showLastPass]);

    // Scroll to newly generated QR
    React.useEffect(() => {
        if (qrVisible && newQrRef.current) {
            setTimeout(() => {
                newQrRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        }
    }, [qrVisible]);

    // Check for saved token on mount
    React.useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        setHasSavedToken(!!token);
        
        // Load saved form data for summary
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setSavedFormData(JSON.parse(saved));
            }
        } catch (error) {
            console.error("Failed to load saved form data:", error);
        }
    }, []);

    // Load saved data from localStorage on mount
    React.useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data: SavedFormData = JSON.parse(saved);
                // Only autofill if the roll matches
                if (data.roll === roll) {
                    setLaptopName(data.laptopName || "");
                    setCarryingDevice(data.carryingDevice ?? true);
                    setPersonalBooks(data.personalBooks || []);
                    setExtraGadgets(data.extraGadgets || []);
                }
            }
        } catch (error) {
            console.error("Failed to load saved form data:", error);
        }
    }, [roll]);

    // Save form data to localStorage
    const saveFormData = () => {
        try {
            const data: SavedFormData = {
                roll,
                laptopName,
                carryingDevice,
                personalBooks,
                extraGadgets,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            setSavedFormData(data);
        } catch (error) {
            console.error("Failed to save form data:", error);
        }
    };

    // Check if form has any data
    const isFormEmpty = !laptopName.trim() && 
        personalBooks.every((b) => !b.name.trim()) && 
        extraGadgets.every((g) => !g.name.trim()) &&
        personalBooks.length === 0 && 
        extraGadgets.length === 0;

    const handleCompleteClick = () => {
        // Validate - at least one field should have data
        if (isFormEmpty) {
            addToast("Please add at least one item", { error: true });
            return;
        }
        // Show confirmation modal
        setShowConfirmModal(true);
    };
    
    const handleConfirm = async (sessionData: SessionData) => {
        setShowConfirmModal(false);
        
        // Hide last pass toggle when generating new QR
        setShowLastPass(false);
        
        // Save to localStorage after user confirms
        saveFormData();
        
        // Show loading toast
        const toastId = addToast("Generating pass...", { loading: true });
        
        let apiResult: any;

        try {
            // artificial delay
            await new Promise<void>((resolve) => setTimeout(resolve, 1500));

            // actual API call
            apiResult = await apiCall("/api/entries/generate/", sessionData);

            // Update to success and remove after delay
            updateToast(toastId, { message: apiResult.data?.message || "No success message!", loading: false });
            setTimeout(() => removeToast(toastId), 1500);

            // Show QR after a brief moment
            setTimeout(() => {
                setQrVisible(true);
            }, 800);
            
            // Save token and update state
            window.localStorage.setItem(TOKEN_KEY, apiResult.data?.token);
            setHasSavedToken(true);
        } catch (err) {
            updateToast(toastId, {
                message: "Failed to generate pass! " + err,
                loading: false,
            });
            setTimeout(() => removeToast(toastId), 1500);
            throw err;
        }
    };


    const handleEdit = () => {
        setQrVisible(false);
        addToast("You can now edit your declaration");
    };

    // Personal Books handlers
    const addPersonalBook = () => {
        if (personalBooks.length < 5) {
            setPersonalBooks([...personalBooks, { name: "", type: "books" }]);
        }
    };

    const removePersonalBook = (index: number) => {
        setPersonalBooks(personalBooks.filter((_, i) => i !== index));
    };

    const updatePersonalBook = (index: number, field: keyof ListItem, value: string) => {
        const updated = [...personalBooks];
        updated[index] = { ...updated[index], [field]: value };
        setPersonalBooks(updated);
    };

    // Extra Gadgets handlers
    const addExtraGadget = () => {
        if (extraGadgets.length < 10) {
            setExtraGadgets([...extraGadgets, { name: "", type: "gadgets" }]);
        }
    };

    const removeExtraGadget = (index: number) => {
        setExtraGadgets(extraGadgets.filter((_, i) => i !== index));
    };

    const updateExtraGadget = (index: number, field: keyof ListItem, value: string) => {
        const updated = [...extraGadgets];
        updated[index] = { ...updated[index], [field]: value };
        setExtraGadgets(updated);
    };

    return (
        <>
            {/* Assets Card */}
            <Card className="mt-5 border-white/10 bg-white/5 py-0 text-white shadow-none backdrop-blur">
                <CardContent className="px-4 py-4">
                    {/* Laptop/Device Toggle */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10">
                                <Laptop className="size-5 text-white/85" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                    Carrying Laptop/Device?
                                </div>
                                <div className="truncate text-xs text-white/55">
                                    Declare before entry
                                </div>
                            </div>
                        </div>
                        <Switch
                            aria-label="Carrying laptop or device"
                            checked={carryingDevice}
                            onCheckedChange={setCarryingDevice}
                            disabled={qrVisible}
                            className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white/20 **:data-[slot=switch-thumb]:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* Laptop Name Input */}
                    <div className="mt-3 pl-13">
                        <Input
                            value={laptopName}
                            onChange={(e) => setLaptopName(safeAutoCapitalize(e.target.value, laptopName))}
                            placeholder="e.g., Macbook Pro"
                            disabled={!carryingDevice || qrVisible}
                            aria-label="Laptop or device name"
                            className="h-10 border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/25 disabled:opacity-60"
                        />
                    </div>

                    {/* Personal Books */}
                    <ItemList
                        title="Personal Books"
                        icon="books"
                        items={personalBooks}
                        maxItems={5}
                        disabled={qrVisible}
                        onAdd={addPersonalBook}
                        onRemove={removePersonalBook}
                        onUpdate={updatePersonalBook}
                        placeholder="Book title..."
                        addLabel="Add Book"
                    />

                    {/* Extra Gadgets */}
                    <ItemList
                        title="Extra Gadgets"
                        icon="gadgets"
                        items={extraGadgets}
                        maxItems={10}
                        disabled={qrVisible}
                        onAdd={addExtraGadget}
                        onRemove={removeExtraGadget}
                        onUpdate={updateExtraGadget}
                        placeholder="Gadget name..."
                        addLabel="Add Gadget"
                    />
                </CardContent>
            </Card>

            {/* Completed Button or QR */}
            {!qrVisible ? (
                <>
                    <CompleteButton
                        disabled={toasts.some((t) => t.loading)}
                        onClick={handleCompleteClick}
                    />
                    
                    {/* View Last Pass Toggle - only show when not generating new QR */}
                    {hasSavedToken && !toasts.some((t) => t.loading) && (
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={() => setShowLastPass(!showLastPass)}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <QrCode className="size-4" />
                                {showLastPass ? "Hide Last Pass" : "View Last Pass"}
                                {showLastPass ? (
                                    <ChevronUp className="size-4 ml-auto" />
                                ) : (
                                    <ChevronDown className="size-4 ml-auto" />
                                )}
                            </button>
                            
                            {/* Summary Card - shown when toggle is OFF */}
                            {!showLastPass && savedFormData && (
                                <Card className="mt-3 border-white/10 bg-white/5 py-0 shadow-none">
                                    <CardContent className="px-4 py-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs font-medium text-white/50">Last Declaration</div>
                                            <button
                                                type="button"
                                                onClick={() => setShowDetailsModal(true)}
                                                className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors"
                                                aria-label="View details"
                                            >
                                                <Eye className="size-3.5" />
                                                <span>View</span>
                                            </button>
                                        </div>
                                        <div className="space-y-1.5 text-sm text-white/80">
                                            {savedFormData.laptopName && (
                                                <div className="flex items-center gap-2">
                                                    <Laptop className="size-3.5 text-amber-400" />
                                                    <span className="truncate">{savedFormData.laptopName}</span>
                                                </div>
                                            )}
                                            {savedFormData.personalBooks?.filter(b => b.name.trim()).length > 0 && (
                                                <div className="text-white/60 text-xs">
                                                    {savedFormData.personalBooks.filter(b => b.name.trim()).length} book(s)
                                                </div>
                                            )}
                                            {savedFormData.extraGadgets?.filter(g => g.name.trim()).length > 0 && (
                                                <div className="text-white/60 text-xs">
                                                    {savedFormData.extraGadgets.filter(g => g.name.trim()).length} gadget(s)
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            
                            {/* QR Display - shown when toggle is ON */}
                            {showLastPass && (
                                <div 
                                    ref={lastPassQrRef}
                                    className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300"
                                >
                                    <QRDisplay onEdit={() => setShowLastPass(false)} />
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div ref={newQrRef}>
                    <QRDisplay onEdit={handleEdit}/>
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handleConfirm}
                roll={roll}
                laptopName={laptopName}
                carryingDevice={carryingDevice}
                personalBooks={personalBooks}
                extraGadgets={extraGadgets}
            />

            {/* View Details Modal */}
            {savedFormData && (
                <ViewDetailsModal
                    isOpen={showDetailsModal}
                    onClose={() => setShowDetailsModal(false)}
                    roll={savedFormData.roll}
                    laptopName={savedFormData.laptopName}
                    personalBooks={savedFormData.personalBooks}
                    extraGadgets={savedFormData.extraGadgets}
                />
            )}
        </>
    );
}
