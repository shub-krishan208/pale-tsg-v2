"use client";

import * as React from "react";
import { Laptop } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ItemList } from "./item-list";
import { QRDisplay, CompleteButton } from "./qr-display";
import { ConfirmationModal } from "./confirmation-modal";
import { useToast } from "./toast-provider";
import { safeAutoCapitalize } from "./utils";
import type { ListItem } from "./types";

type AssetDeclarationFormProps = {
    roll: string;
};

export function AssetDeclarationForm({ roll }: AssetDeclarationFormProps) {
    const { toasts, addToast, removeToast, updateToast } = useToast();

    const [carryingDevice, setCarryingDevice] = React.useState(true);
    const [laptopName, setLaptopName] = React.useState("");
    const [personalBooks, setPersonalBooks] = React.useState<ListItem[]>([]);
    const [extraGadgets, setExtraGadgets] = React.useState<ListItem[]>([]);
    const [qrVisible, setQrVisible] = React.useState(false);
    const [showConfirmModal, setShowConfirmModal] = React.useState(false);

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

    const handleConfirm = async () => {
        setShowConfirmModal(false);

        // Show loading toast
        const toastId = addToast("Generating pass...", { loading: true });
        
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // Update to success and remove after delay
        updateToast(toastId, { message: "Pass generated!", loading: false });
        setTimeout(() => removeToast(toastId), 1500);
        
        // Show QR after a brief moment
        setTimeout(() => {
            setQrVisible(true);
        }, 800);
    };

    const handleEdit = () => {
        setQrVisible(false);
        addToast("You can now edit your declaration");
    };

    // Personal Books handlers
    const addPersonalBook = () => {
        if (personalBooks.length < 5) {
            setPersonalBooks([...personalBooks, { name: "", type: "book" }]);
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
            setExtraGadgets([...extraGadgets, { name: "", type: "gadget" }]);
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
                <CompleteButton
                    disabled={toasts.some((t) => t.loading)}
                    onClick={handleCompleteClick}
                />
            ) : (
                <QRDisplay onEdit={handleEdit} />
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
        </>
    );
}
