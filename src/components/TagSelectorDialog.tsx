"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";

interface TagSelectorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTags: string[];
    onSelectTags: (tags: string[]) => void;
    availableTags: { tag: string; count: number }[];
}

export default function TagSelectorDialog({
    isOpen,
    onClose,
    selectedTags,
    onSelectTags,
    availableTags
}: TagSelectorDialogProps) {
    const [localSelectedTags, setLocalSelectedTags] = useState<string[]>(selectedTags);

    useEffect(() => {
        setLocalSelectedTags(selectedTags);
    }, [selectedTags, isOpen]);

    if (!isOpen) return null;

    const toggleTag = (tag: string) => {
        if (localSelectedTags.includes(tag)) {
            setLocalSelectedTags(localSelectedTags.filter(t => t !== tag));
        } else {
            setLocalSelectedTags([...localSelectedTags, tag]);
        }
    };

    const handleConfirm = () => {
        onSelectTags(localSelectedTags);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Tags</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {availableTags.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No tags available yet. Add some tags manually first!</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {availableTags.map(({ tag, count }) => {
                                const isSelected = localSelectedTags.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`
                                            flex items-center gap-2 p-2 rounded border transition-colors
                                            ${isSelected
                                                ? 'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                                                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                                            }
                                        `}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="text-sm font-medium flex-1 text-left">{tag}</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">({count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 p-4 border-t dark:border-gray-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Apply ({localSelectedTags.length} selected)
                    </button>
                </div>
            </div>
        </div>
    );
}
