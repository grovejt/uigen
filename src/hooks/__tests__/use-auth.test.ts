import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { useAuth } from "@/hooks/use-auth";

const mockSignInAction = vi.mocked(signInAction);
const mockSignUpAction = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

test("isLoading starts as false", () => {
  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);
});

// ---------------------------------------------------------------------------
// signIn – happy paths
// ---------------------------------------------------------------------------

describe("signIn", () => {
  test("sets isLoading to true during execution and false after", async () => {
    let resolveSignIn!: (v: any) => void;
    mockSignInAction.mockReturnValue(
      new Promise((res) => (resolveSignIn = res))
    );

    const { result } = renderHook(() => useAuth());

    let signInPromise: Promise<any>;
    act(() => {
      signInPromise = result.current.signIn("user@example.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: false, error: "bad creds" });
      await signInPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("calls signInAction with the provided email and password", async () => {
    mockSignInAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "secret123");
    });

    expect(mockSignInAction).toHaveBeenCalledOnce();
    expect(mockSignInAction).toHaveBeenCalledWith(
      "user@example.com",
      "secret123"
    );
  });

  test("returns the result from signInAction", async () => {
    const actionResult = { success: true };
    mockSignInAction.mockResolvedValue(actionResult);
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }] as any);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "pass");
    });

    expect(returnValue).toEqual(actionResult);
  });

  test("with anon work: creates project from anon work, clears it, and navigates", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/": {} },
    });
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledOnce();
    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        data: { "/": {} },
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
  });

  test("with anon work but empty messages: skips anon project creation", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [],
      fileSystemData: {},
    });
    mockGetProjects.mockResolvedValue([{ id: "existing-project" }] as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-project");
  });

  test("without anon work and with existing projects: navigates to first project", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([
      { id: "first-project" },
      { id: "second-project" },
    ] as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/first-project");
  });

  test("without anon work and no existing projects: creates a new project and navigates", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-project" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledOnce();
    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
  });

  // -------------------------------------------------------------------------
  // signIn – error / failure states
  // -------------------------------------------------------------------------

  test("when signInAction returns success:false, does not navigate", async () => {
    mockSignInAction.mockResolvedValue({
      success: false,
      error: "Invalid credentials",
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "wrong-pass");
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("when signInAction returns success:false, returns the error result", async () => {
    const errorResult = { success: false, error: "Invalid credentials" };
    mockSignInAction.mockResolvedValue(errorResult);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "bad");
    });

    expect(returnValue).toEqual(errorResult);
  });

  test("resets isLoading to false even when signInAction throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signUp – happy paths
// ---------------------------------------------------------------------------

describe("signUp", () => {
  test("sets isLoading to true during execution and false after", async () => {
    let resolveSignUp!: (v: any) => void;
    mockSignUpAction.mockReturnValue(
      new Promise((res) => (resolveSignUp = res))
    );

    const { result } = renderHook(() => useAuth());

    let signUpPromise: Promise<any>;
    act(() => {
      signUpPromise = result.current.signUp("user@example.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: false });
      await signUpPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("calls signUpAction with the provided email and password", async () => {
    mockSignUpAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("newuser@example.com", "newpassword");
    });

    expect(mockSignUpAction).toHaveBeenCalledOnce();
    expect(mockSignUpAction).toHaveBeenCalledWith(
      "newuser@example.com",
      "newpassword"
    );
  });

  test("returns the result from signUpAction", async () => {
    const actionResult = { success: true };
    mockSignUpAction.mockResolvedValue(actionResult);
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }] as any);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("user@example.com", "pass");
    });

    expect(returnValue).toEqual(actionResult);
  });

  test("with anon work: creates project from anon work, clears it, and navigates", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "build me a button" }],
      fileSystemData: { "/": {}, "/App.tsx": {} },
    });
    mockCreateProject.mockResolvedValue({ id: "anon-signup-project" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("newuser@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledOnce();
    expect(mockClearAnonWork).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/anon-signup-project");
  });

  test("without anon work and existing projects: navigates to first project", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }] as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("newuser@example.com", "pass");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });

  test("without anon work and no projects: creates new project and navigates", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "fresh-project" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("newuser@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/fresh-project");
  });

  // -------------------------------------------------------------------------
  // signUp – error / failure states
  // -------------------------------------------------------------------------

  test("when signUpAction returns success:false, does not navigate", async () => {
    mockSignUpAction.mockResolvedValue({
      success: false,
      error: "Email already registered",
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("taken@example.com", "pass");
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("when signUpAction returns success:false, returns the error result", async () => {
    const errorResult = { success: false, error: "Email already registered" };
    mockSignUpAction.mockResolvedValue(errorResult);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("taken@example.com", "pass");
    });

    expect(returnValue).toEqual(errorResult);
  });

  test("resets isLoading to false even when signUpAction throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("user@example.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});
