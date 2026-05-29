import { useEffect, useState } from "react";
import StepFolder from "./components/StepFolder.jsx";
import StepProducts from "./components/StepProducts.jsx";
import StepCapabilities from "./components/StepCapabilities.jsx";
import StepStaffing from "./components/StepStaffing.jsx";
import StepGenerate from "./components/StepGenerate.jsx";
import Summary from "./components/Summary.jsx";

const STEPS = [
  { id: "folder",       num: "01", label: "Project Details",  hint: "Client, commercials, volumetrics" },
  { id: "products",     num: "02", label: "SAP Products",     hint: "Select products in scope" },
  { id: "capabilities", num: "03", label: "Capabilities",     hint: "Pick architecture capabilities" },
  { id: "staffing",     num: "04", label: "Resource Loading", hint: "Edit aggregated FTE per role" },
  { id: "generate",     num: "05", label: "Generate",         hint: "Produce PPTX + DOCX" },
];

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DEFAULT_TEAM = [
  ["Solution Architect", "", ""],
  ["Engagement Lead", "", ""],
  ["Tower Lead — Basis", "", ""],
  ["Tower Lead — SolMan / Cloud ALM", "", ""],
  ["Tower Lead — Security", "", ""],
  ["Service Delivery Manager", "", ""],
];

export default function App() {
  const [activeStep, setActiveStep] = useState("folder");
  const [health, setHealth] = useState(null);

  // Project identity
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [marketUnit, setMarketUnit] = useState("EMEA");
  const [notes, setNotes] = useState("");

  // Commercials
  const [contractValue, setContractValue] = useState("");
  const [contractType, setContractType] = useState("Fixed · Output-based AO");
  const [contractTerm, setContractTerm] = useState("36 months");
  const [cci, setCci] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("12×6 + 24×7 P1/P2");

  // Team
  const [team, setTeam] = useState(DEFAULT_TEAM);

  // Volumetrics
  const [volumetrics, setVolumetrics] = useState({
    users: "",
    incidents: "",
    tickets: "",
    changes: "",
    prodSids: "",
    nonProdSids: "",
    saasApps: "",
    btpServices: "",
    securityTickets: "",
    rolesManaged: "",
    sodViolations: "",
    firefighterSessions: "",
  });

  // Assumptions / OoS (one per line)
  const [assumptionsText, setAssumptionsText] = useState("");
  const [outOfScopeText, setOutOfScopeText] = useState("");

  // Selections
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState([]);

  // Resource loading (aggregated)
  const [staffing, setStaffing] = useState([]);
  const [staffingSeed, setStaffingSeed] = useState("");

  // User instructions for LLM
  const [userInstructions, setUserInstructions] = useState("");

  // Output
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setHealth({ ok: false, error: e.message }));
  }, []);

  const completed = {
    folder: !!clientName && !!projectName,
    products: selectedProducts.length > 0,
    capabilities: selectedCapabilities.length > 0,
    staffing: staffing.length > 0,
    generate: !!output,
  };

  function StepView() {
    if (activeStep === "folder")
      return (
        <StepFolder
          clientName={clientName}
          setClientName={setClientName}
          projectName={projectName}
          setProjectName={setProjectName}
          opportunityId={opportunityId}
          setOpportunityId={setOpportunityId}
          marketUnit={marketUnit}
          setMarketUnit={setMarketUnit}
          contractValue={contractValue}
          setContractValue={setContractValue}
          contractType={contractType}
          setContractType={setContractType}
          contractTerm={contractTerm}
          setContractTerm={setContractTerm}
          cci={cci}
          setCci={setCci}
          deliveryWindow={deliveryWindow}
          setDeliveryWindow={setDeliveryWindow}
          team={team}
          setTeam={setTeam}
          volumetrics={volumetrics}
          setVolumetrics={setVolumetrics}
          assumptionsText={assumptionsText}
          setAssumptionsText={setAssumptionsText}
          outOfScopeText={outOfScopeText}
          setOutOfScopeText={setOutOfScopeText}
          notes={notes}
          setNotes={setNotes}
          onNext={() => setActiveStep("products")}
        />
      );
    if (activeStep === "products")
      return (
        <StepProducts
          selected={selectedProducts}
          setSelected={setSelectedProducts}
          onNext={() => setActiveStep("capabilities")}
          onBack={() => setActiveStep("folder")}
        />
      );
    if (activeStep === "capabilities")
      return (
        <StepCapabilities
          selected={selectedCapabilities}
          setSelected={setSelectedCapabilities}
          contractTerm={contractTerm}
          onNext={() => setActiveStep("staffing")}
          onBack={() => setActiveStep("products")}
        />
      );
    if (activeStep === "staffing")
      return (
        <StepStaffing
          capabilities={selectedCapabilities}
          staffing={staffing}
          setStaffing={setStaffing}
          staffingSeed={staffingSeed}
          setStaffingSeed={setStaffingSeed}
          onNext={() => setActiveStep("generate")}
          onBack={() => setActiveStep("capabilities")}
        />
      );
    return (
      <StepGenerate
        meta={{
          clientName,
          projectName,
          opportunityId,
          marketUnit,
          contractValue,
          contractType,
          contractTerm,
          cci,
          deliveryWindow,
          team: team.filter((r) => r[0] || r[1]),
          volumetrics,
          staffing,
          assumptions: assumptionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          outOfScope: outOfScopeText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          notes,
          userInstructions,
        }}
        userInstructions={userInstructions}
        setUserInstructions={setUserInstructions}
        products={selectedProducts}
        capabilities={selectedCapabilities}
        setCapabilities={setSelectedCapabilities}
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
        output={output}
        setOutput={setOutput}
        onBack={() => setActiveStep("staffing")}
      />
    );
  }

  const activeIdx = STEPS.findIndex((s) => s.id === activeStep);
  const activeMeta = STEPS[activeIdx] || STEPS[0];

  return (
    <div className="app">
      <div className="ticker">
        <span className="dot-live" />
        <span>Atelier · Live</span>
        <span className="sep">/</span>
        <span>{nowStamp()}</span>
        <span className="sep">/</span>
        <span>Folio №{String(activeIdx + 1).padStart(2, "0")}/05</span>
        <span className="sep">/</span>
        <span>SAP BG Tech Factory</span>
        <span className="grow" />
        <span>An <em>editorial</em> tool for solution architects</span>
      </div>

      <div className="topbar">
        <div className="brand">
          <div className="mark">
            <span className="chev">&gt;</span>accenture<span className="amp">.</span>
          </div>
          <div className="seal">Rfp · SAP Tech Factory</div>
        </div>

        <div className="masthead">
          <div className="super">Folio {activeMeta.num} · of 05</div>
          <h1>
            The Solution Builder<span className="punct">.</span>
          </h1>
        </div>

        <div className="status-block">
          {health?.ok ? (
            <span className="pill ok">
              <span className="led" />
              VectorDB · {health.tables.sap_products} prod · {health.tables.arch_trees} nodes
            </span>
          ) : (
            <span className="pill err">
              <span className="led" />
              {health?.error ? "DB unreachable" : "Handshaking…"}
            </span>
          )}
        </div>
      </div>

      <div className="main">
        <aside className="sidebar">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={
                "step " +
                (activeStep === s.id ? "active " : "") +
                (completed[s.id] ? "done" : "")
              }
              onClick={() => setActiveStep(s.id)}
            >
              <div className="num">{s.num}</div>
              <div className="meta">
                <div className="label">{s.label}</div>
                <div className="hint">{s.hint}</div>
              </div>
            </div>
          ))}
        </aside>

        <main className="content" key={activeStep}>{StepView()}</main>

        <aside className="summary">
          <Summary
            clientName={clientName}
            projectName={projectName}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            selectedCapabilities={selectedCapabilities}
            setSelectedCapabilities={setSelectedCapabilities}
            output={output}
          />
        </aside>
      </div>
    </div>
  );
}
