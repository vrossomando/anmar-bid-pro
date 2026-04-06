import ListTakeoffForm, { type ListFormConfig } from "./ListTakeoffForm";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../SectionBreakdownModal";

const CONFIG: ListFormConfig = {
  title: "Generator Takeoff",
  categoryLabel: "Generator",
  dbCategory: "Miscellaneous Items",
  dbCategoryAlt: "Gear",
  searchTerms: [
    "generator", "fuel tank", "transfer switch", "automatic transfer",
    "manual transfer", "ATS unit", "generator set",
  ],
  filterChips: [
    "All",
    "Generators",
    "Fuel Tanks",
    "Automatic Transfer Switches",
    "Manual Transfer Switches",
    "Demo / Removal",
  ],
  filterMap: {
    "Generators":                  "generator",
    "Fuel Tanks":                  "fuel tank",
    "Automatic Transfer Switches": "automatic transfer",
    "Manual Transfer Switches":    "manual transfer",
    "Demo / Removal":              "demo generator",
  },
  searchPlaceholder: "Search generators, ATS, fuel tanks…",
  width: 760,
};

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function GeneratorTakeoffForm(props: Props) {
  return <ListTakeoffForm {...props} config={CONFIG} />;
}
