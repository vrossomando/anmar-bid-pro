import ListTakeoffForm, { type ListFormConfig } from "./ListTakeoffForm";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../SectionBreakdownModal";

const CONFIG: ListFormConfig = {
  title: "Exposed Ceiling Supports Takeoff",
  categoryLabel: "Supports",
  dbCategory: "Miscellaneous Items",
  dbCategoryAlt: "Conduit / Wire Feeders",
  searchTerms: [
    "threaded rod", "unistrut", "strut strap", "beam clamp",
    "conduit hanger", "seismic wire", "tie wire", "j-hook",
    "trapeze", "bridle ring", "cable support", "hanger bolt",
    "1-hole strap", "1 hole strap",
  ],
  filterChips: [
    "All",
    "Threaded Rod",
    "Unistrut / Strut",
    "Beam Clamps",
    "Conduit Hangers",
    "Straps",
    "Seismic / Tie Wire",
    "J-Hooks",
  ],
  filterMap: {
    "Threaded Rod":      "threaded rod",
    "Unistrut / Strut":  "unistrut",
    "Beam Clamps":       "beam clamp",
    "Conduit Hangers":   "conduit hanger",
    "Straps":            "strap",
    "Seismic / Tie Wire":"seismic",
    "J-Hooks":           "j-hook",
  },
  searchPlaceholder: "Search supports, hangers, rods, strut…",
  width: 780,
};

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function SupportsTakeoffForm(props: Props) {
  return <ListTakeoffForm {...props} config={CONFIG} />;
}
