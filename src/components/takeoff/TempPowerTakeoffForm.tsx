import ListTakeoffForm, { type ListFormConfig } from "./ListTakeoffForm";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../SectionBreakdownModal";

const CONFIG: ListFormConfig = {
  title: "Temporary Lighting & Power Takeoff",
  categoryLabel: "Temporary",
  dbCategory: "Miscellaneous Items",
  dbCategoryAlt: "Gear",
  searchTerms: [
    "temporary stringer", "stringer", "power pole",
    "cam-lock", "camlock", "spider box",
    "ground fault", "portable", "telepower",
    "construction",
  ],
  filterChips: [
    "All",
    "Stringers",
    "Power Poles",
    "Cam-Lock / GFI",
    "Spider Boxes",
    "Telepower Poles",
  ],
  filterMap: {
    "Stringers":       "stringer",
    "Power Poles":     "power pole",
    "Cam-Lock / GFI":  "cam-lock",
    "Spider Boxes":    "spider box",
    "Telepower Poles": "telepower",
  },
  searchPlaceholder: "Search temporary lighting & power items…",
  width: 760,
};

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function TempPowerTakeoffForm(props: Props) {
  return <ListTakeoffForm {...props} config={CONFIG} />;
}
