"use client";

import { createContext, useContext, useState } from "react";

// Shares the booking card's selected room id with the page's room showcase, so the
// "The room" section below can render only the room the guest picked in the card.
type SelectedRoom = {
  selectedRoomId: string;
  setSelectedRoomId: (id: string) => void;
};

const SelectedRoomContext = createContext<SelectedRoom | null>(null);

export function SelectedRoomProvider({
  initialRoomId,
  children,
}: {
  initialRoomId: string;
  children: React.ReactNode;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  return (
    <SelectedRoomContext.Provider value={{ selectedRoomId, setSelectedRoomId }}>
      {children}
    </SelectedRoomContext.Provider>
  );
}

export function useSelectedRoom() {
  const ctx = useContext(SelectedRoomContext);
  if (!ctx) throw new Error("useSelectedRoom must be used within a SelectedRoomProvider");
  return ctx;
}
