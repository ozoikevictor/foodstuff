import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Access } from "@/components/marketplace/shared";

const mocks = vi.hoisted(() => ({ session: vi.fn(), navigate: vi.fn() }));
vi.mock("@/hooks/use-marketplace", () => ({ useSession: mocks.session }));
vi.mock("@tanstack/react-router", () => ({ Navigate: (props: unknown) => { mocks.navigate(props); return null; } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Protected page access", () => {
  it.each([undefined, "CUSTOMER", "ADMIN", "RIDER"])("redirects signed-out visitors directly to login for %s", role => {
    mocks.session.mockReturnValue({isPending:false,isError:false,data:null});
    render(<Access {...(role ? {role} : {})}><div>Private page</div></Access>);
    expect(mocks.navigate).toHaveBeenCalledWith({to:"/login",replace:true});
    expect(screen.queryByText("Private page")).toBeNull();
    expect(screen.queryByText("Log in to continue")).toBeNull();
  });
  it("waits for the session before deciding to redirect", () => {
    mocks.session.mockReturnValue({isPending:true,isError:false});
    render(<Access><div>Private page</div></Access>);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("keeps role restrictions for signed-in customers", () => {
    mocks.session.mockReturnValue({isPending:false,isError:false,data:{role:"CUSTOMER"}});
    render(<Access role="ADMIN"><div>Private page</div></Access>);
    expect(screen.getByRole("alert").textContent).toContain("permission");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("renders an authorized page", () => {
    mocks.session.mockReturnValue({isPending:false,isError:false,data:{role:"CUSTOMER"}});
    render(<Access role="CUSTOMER"><div>Private page</div></Access>);
    expect(screen.getByText("Private page")).toBeTruthy();
  });
});
