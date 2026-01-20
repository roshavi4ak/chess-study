"use client";

import { useState } from "react";
import NameUpdateDialog from "@/components/NameUpdateDialog";

interface DashboardNameManagerProps {
    isNameSet: boolean;
}

export default function DashboardNameManager({ isNameSet }: DashboardNameManagerProps) {
    const [isOpen, setIsOpen] = useState(!isNameSet);

    return (
        <NameUpdateDialog
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
        />
    );
}
