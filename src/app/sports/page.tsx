"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navbar } from "@/components/Navbar";

const SPORTS = [
  {
    id: "golf",
    name: "Golf",
    emoji: "⛳",
    description: "Pick golfers from tiered groups, track PGA tournaments",
    color: "from-green-600 to-emerald-700",
    hoverColor: "hover:border-green-400",
    bgAccent: "bg-green-50",
  },
  {
    id: "football",
    name: "Football",
    emoji: "⚽",
    description: "Pick teams from tiered groups, track World Cup, Premier League, and more",
    color: "from-blue-600 to-indigo-700",
    hoverColor: "hover:border-blue-400",
    bgAccent: "bg-blue-50",
  },
] as const;

function SportsContent() {
  const { user } = useAuth();

  return (
    <div className="w-full px-6 py-8 sm:px-12 sm:py-12 lg:px-20">
      <div className="mb-8 sm:mb-12 text-center">
        <p className="text-sm font-medium text-green-700 mb-1">
          Welcome{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800 sm:text-3xl">
          Choose Your Sport
        </h1>
        <p className="mt-2 text-gray-500">
          Pick a sport to view your parties or create a new one
        </p>
      </div>

      <div className="mx-auto max-w-2xl grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {SPORTS.map((sport) => (
          <Link
            key={sport.id}
            href={`/dashboard?sport=${sport.id}`}
            className={`group relative overflow-hidden rounded-2xl border-2 border-gray-200 bg-white p-6 text-left transition-all ${sport.hoverColor} hover:shadow-lg sm:p-8`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${sport.color} opacity-0 transition-opacity group-hover:opacity-5`} />
            <div className="relative">
              <div className="mb-4 text-5xl">{sport.emoji}</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {sport.name}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                {sport.description}
              </p>
            </div>
            <div className="mt-4 flex items-center text-sm font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
              <span>View parties</span>
              <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SportsPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <SportsContent />
    </ProtectedRoute>
  );
}
