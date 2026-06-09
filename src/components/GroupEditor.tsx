"use client";

import { useState } from "react";
import type { Player, PlayerGroup } from "@/types";

/** Minimal item shape the editor can work with */
export interface GroupItem {
  id: string;
  displayName: string;
  logo?: string;
  country?: string;
}

interface GroupEditorProps {
  groups: Record<string, GroupItem[]>;
  wildcards: GroupItem[];
  fieldAvailable: boolean;
  onSave: (groups: Record<string, GroupItem[]>) => void;
  /** "player" for golf, "team" or "country" for football */
  entityType?: "player" | "team" | "country";
}

const GROUP_NAMES: PlayerGroup[] = ["A", "B", "C", "D"];
const GROUP_COLORS: Record<string, string> = {
  A: "border-red-300 bg-red-50",
  B: "border-blue-300 bg-blue-50",
  C: "border-yellow-300 bg-yellow-50",
  D: "border-purple-300 bg-purple-50",
};

const GROUP_LABELS_BY_TYPE: Record<string, Record<string, string>> = {
  player: {
    A: "Group A - Elite",
    B: "Group B - Contenders",
    C: "Group C - Rising Stars",
    D: "Group D - Dark Horses",
  },
  team: {
    A: "Tier A - Favourites",
    B: "Tier B - Contenders",
    C: "Tier C - Midfield",
    D: "Tier D - Underdogs",
  },
  country: {
    A: "Tier A - Favourites",
    B: "Tier B - Contenders",
    C: "Tier C - Rising Nations",
    D: "Tier D - Underdogs",
  },
};

export function GroupEditor({ groups, wildcards, fieldAvailable, onSave, entityType = "player" }: GroupEditorProps) {
  const [editGroups, setEditGroups] = useState<Record<string, GroupItem[]>>({
    A: [...groups.A],
    B: [...groups.B],
    C: [...groups.C],
    D: [...groups.D],
  });
  const [pool, setPool] = useState<GroupItem[]>([...wildcards]);
  const [selectedItem, setSelectedItem] = useState<{ item: GroupItem; from: string } | null>(null);
  const [poolSearch, setPoolSearch] = useState("");

  const entityLabel = entityType === "player" ? "player" : entityType === "country" ? "country" : "team";
  const entitiesLabel = entityType === "player" ? "players" : entityType === "country" ? "countries" : "teams";
  const groupLabels = GROUP_LABELS_BY_TYPE[entityType] || GROUP_LABELS_BY_TYPE.player;

  const moveToGroup = (item: GroupItem, fromKey: string, toGroup: string) => {
    const updated = { ...editGroups };

    if (fromKey === "pool") {
      setPool((prev) => prev.filter((p) => p.id !== item.id));
    } else {
      updated[fromKey] = updated[fromKey].filter((p) => p.id !== item.id);
    }

    if (toGroup === "pool") {
      setPool((prev) => [...prev, item]);
    } else {
      updated[toGroup] = [...(updated[toGroup] || []), item];
    }

    setEditGroups(updated);
    setSelectedItem(null);
  };

  const handleItemClick = (item: GroupItem, from: string) => {
    if (selectedItem?.item.id === item.id) {
      setSelectedItem(null);
    } else {
      setSelectedItem({ item, from });
    }
  };

  const totalGrouped = Object.values(editGroups).reduce((sum, g) => sum + g.length, 0);

  const filteredPool = pool.filter((p) =>
    p.displayName.toLowerCase().includes(poolSearch.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            Customise {entityType === "player" ? "Player" : entityType === "country" ? "Country" : "Team"} Groups
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {fieldAvailable
              ? `Click a ${entityLabel}, then click a group to move them.`
              : entityType === "player"
                ? "Field not announced yet - using OWGR rankings."
                : `Using ${entityType === "country" ? "FIFA" : "league"} rankings.`}
          </p>
        </div>
        <span className="text-xs text-gray-500">{totalGrouped} {entitiesLabel} in groups</span>
      </div>

      {selectedItem && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-3 py-2.5 text-sm sm:px-4">
          <p className="mb-2 sm:mb-0 sm:inline">
            Move <strong>{selectedItem.item.displayName}</strong> to:
          </p>
          <div className="flex flex-wrap gap-2 mt-1.5 sm:mt-0 sm:inline-flex sm:ml-2">
            {GROUP_NAMES.filter((g) => g !== selectedItem.from).map((g) => (
              <button
                type="button" key={g}
                onClick={() => moveToGroup(selectedItem.item, selectedItem.from, g)}
                className="rounded bg-white border border-gray-300 px-3 py-2 text-xs font-medium hover:bg-gray-50 min-h-[44px] min-w-[44px]"
              >
                {entityType === "player" ? "Group" : "Tier"} {g}
              </button>
            ))}
            {selectedItem.from !== "pool" && (
              <button
                type="button" onClick={() => moveToGroup(selectedItem.item, selectedItem.from, "pool")}
                className="rounded bg-gray-200 px-3 py-2 text-xs font-medium hover:bg-gray-300 min-h-[44px]"
              >
                → Wildcard
              </button>
            )}
            <button
              type="button" onClick={() => setSelectedItem(null)}
              className="rounded px-3 py-2 text-xs text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Groups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {GROUP_NAMES.map((g) => (
          <div key={g} className={`rounded-lg border-2 p-3 ${GROUP_COLORS[g]}`}>
            <h4 className="text-xs font-bold text-gray-700 mb-2">
              {groupLabels[g]} ({editGroups[g].length})
            </h4>
            <div className="space-y-1.5">
              {editGroups[g].map((item) => (
                <button
                  type="button" key={item.id}
                  onClick={() => handleItemClick(item, g)}
                  className={`w-full text-left rounded-md border px-3 py-1.5 text-sm transition-all flex items-center gap-2 ${
                    selectedItem?.item.id === item.id
                      ? "border-green-500 bg-green-100 ring-2 ring-green-300"
                      : "border-gray-200 bg-white hover:border-gray-400"
                  }`}
                >
                  {item.logo && (
                    <img src={item.logo} alt="" className="h-4 w-4 object-contain flex-shrink-0" />
                  )}
                  <span>{item.displayName}</span>
                  {item.country && !item.logo && (
                    <span className="ml-1 text-xs text-gray-400">({item.country})</span>
                  )}
                </button>
              ))}
              {editGroups[g].length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">Click a {entityLabel} below to add to this group</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Wildcard Pool */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-gray-700">Wildcard Pool ({pool.length})</h4>
        </div>
        <input
          type="text"
          placeholder={`Search ${entitiesLabel}...`}
          value={poolSearch}
          onChange={(e) => setPoolSearch(e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm mb-2 text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
          {filteredPool.map((item) => (
            <button
              type="button" key={item.id}
              onClick={() => handleItemClick(item, "pool")}
              className={`text-left rounded-md border px-3 py-2.5 text-xs transition-all flex items-center gap-1.5 ${
                selectedItem?.item.id === item.id
                  ? "border-green-500 bg-green-100 ring-2 ring-green-300"
                  : "border-gray-200 bg-white hover:border-gray-400"
              }`}
            >
              {item.logo && (
                <img src={item.logo} alt="" className="h-4 w-4 object-contain flex-shrink-0" />
              )}
              <span>{item.displayName}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button" onClick={() => onSave(editGroups)}
        className="mt-4 w-full rounded-lg bg-green-700 py-2.5 text-sm font-medium text-white hover:bg-green-600 transition-colors"
      >
        ✓ Confirm Groups
      </button>
    </div>
  );
}
