import SectionHeader from "../components/report_sections/SectionHeader";
import SectionA from "../components/report_sections/SectionA_Metadata";
import SectionB from "../components/report_sections/SectionB_Source";
import SectionC from "../components/report_sections/SectionC_Body";
import SectionD from "../components/report_sections/SectionD_Outputs";


export default function CreateReport() {
  return <div>
    <SectionHeader />
    <SectionA />
    <SectionB />
    <SectionC />
    <SectionD />
</div>;
}