import { useState } from "react";
import { AddProblemForm } from "../components/AddProblemForm";
import { CsvImport } from "../components/CsvImport";

export default function Add() {
  const [mode, setMode] = useState<"one" | "csv">("one");
  return (
    <>
      <h1>Add problems</h1>
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "one"}
          className={`tab${mode === "one" ? " active" : ""}`}
          onClick={() => setMode("one")}
        >
          One problem
        </button>
        <button
          role="tab"
          aria-selected={mode === "csv"}
          className={`tab${mode === "csv" ? " active" : ""}`}
          onClick={() => setMode("csv")}
        >
          Import CSV
        </button>
      </div>
      {mode === "one" ? <AddProblemForm /> : <CsvImport />}
    </>
  );
}
