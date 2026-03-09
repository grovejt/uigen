import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  ToolInvocationDisplay,
  getToolLabel,
} from "../ToolInvocationDisplay";

afterEach(() => {
  cleanup();
});

// ─── getToolLabel unit tests ───────────────────────────────────────────────

test("getToolLabel: str_replace_editor create", () => {
  expect(
    getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" })
  ).toBe("Creating /App.jsx");
});

test("getToolLabel: str_replace_editor str_replace", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "str_replace",
      path: "/components/Card.jsx",
    })
  ).toBe("Editing /components/Card.jsx");
});

test("getToolLabel: str_replace_editor insert", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "insert",
      path: "/components/Card.jsx",
    })
  ).toBe("Editing /components/Card.jsx");
});

test("getToolLabel: str_replace_editor view", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "view",
      path: "/utils/helpers.ts",
    })
  ).toBe("Viewing /utils/helpers.ts");
});

test("getToolLabel: str_replace_editor unknown command falls back to Editing", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "undo_edit",
      path: "/file.tsx",
    })
  ).toBe("Editing /file.tsx");
});

test("getToolLabel: file_manager rename with new_path", () => {
  expect(
    getToolLabel("file_manager", {
      command: "rename",
      path: "/old.jsx",
      new_path: "/new.jsx",
    })
  ).toBe("Renaming /old.jsx → /new.jsx");
});

test("getToolLabel: file_manager rename without new_path", () => {
  expect(
    getToolLabel("file_manager", { command: "rename", path: "/old.jsx" })
  ).toBe("Renaming /old.jsx");
});

test("getToolLabel: file_manager delete", () => {
  expect(
    getToolLabel("file_manager", {
      command: "delete",
      path: "/components/Card.jsx",
    })
  ).toBe("Deleting /components/Card.jsx");
});

test("getToolLabel: unknown tool returns raw toolName", () => {
  expect(getToolLabel("some_unknown_tool", { command: "run" })).toBe(
    "some_unknown_tool"
  );
});

test("getToolLabel: missing args.path falls back to 'file'", () => {
  expect(getToolLabel("str_replace_editor", { command: "create" })).toBe(
    "Creating file"
  );
});

// ─── ToolInvocationDisplay render tests ───────────────────────────────────

test("ToolInvocationDisplay shows spinner and label when in progress", () => {
  render(
    <ToolInvocationDisplay
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="call"
      result={undefined}
    />
  );

  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
  expect(screen.getByTestId("loading-indicator")).toBeDefined();
  expect(screen.queryByTestId("done-indicator")).toBeNull();
});

test("ToolInvocationDisplay shows green dot and label when done", () => {
  render(
    <ToolInvocationDisplay
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      result={{ success: true }}
    />
  );

  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
  expect(screen.getByTestId("done-indicator")).toBeDefined();
  expect(screen.queryByTestId("loading-indicator")).toBeNull();
});

test("ToolInvocationDisplay treats result=null as in-progress", () => {
  render(
    <ToolInvocationDisplay
      toolName="str_replace_editor"
      args={{ command: "str_replace", path: "/components/Card.jsx" }}
      state="result"
      result={null}
    />
  );

  expect(screen.getByTestId("loading-indicator")).toBeDefined();
  expect(screen.queryByTestId("done-indicator")).toBeNull();
});
