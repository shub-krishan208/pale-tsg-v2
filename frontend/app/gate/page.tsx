import { Metadata } from "next";
import { GateMonitor } from "@/components/gate/gate-monitor";

export const metadata: Metadata = {
  title: "Central Library Gate Monitor",
  description: "Live student entry and exit verification display monitor",
};

export default function GatePage() {
  return <GateMonitor />;
}
