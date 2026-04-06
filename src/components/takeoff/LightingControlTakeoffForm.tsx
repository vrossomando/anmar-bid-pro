import ListTakeoffForm, { type ListFormConfig } from "./ListTakeoffForm";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../SectionBreakdownModal";

const CONFIG: ListFormConfig = {
  title: "Lighting Control Takeoff",
  categoryLabel: "Lighting Control",
  dbCategory: "Lights & Devices",
  dbCategoryAlt: "Miscellaneous Items",
  searchTerms: [
    "dimmer", "occupancy sensor", "vacancy sensor", "photocell",
    "daylight", "lutron", "lighting control", "0-10v", "auto switch",
    "room controller", "relay panel", "power pack", "ultrasonic",
  ],
  filterChips: [
    "All",
    "Dimmers",
    "Occupancy Sensors",
    "Photocell",
    "Lutron",
    "Relay / Panel",
    "Power Pack",
  ],
  filterMap: {
    "Dimmers":           "dimmer",
    "Occupancy Sensors": "occupancy",
    "Photocell":         "photocell",
    "Lutron":            "lutron",
    "Relay / Panel":     "relay",
    "Power Pack":        "power pack",
  },
  searchPlaceholder: "Search lighting control items…",
  width: 760,
};

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function LightingControlTakeoffForm(props: Props) {
  return <ListTakeoffForm {...props} config={CONFIG} />;
}
