import { NextResponse } from "next/server";
import { getActiveSubscription, getOwnedBusiness } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { user, businessId, error: accountError } = await getOwnedBusiness();
    if (accountError === "unauthenticated") {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    if (accountError || !businessId || !user) {
      return NextResponse.json({ error: "Business owner access is required." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: memberships, error: membershipError } = await admin
      .from("business_members")
      .select("user_id, role, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (membershipError) throw membershipError;

    const members = await Promise.all(
      (memberships ?? []).map(async (membership) => {
        const { data, error } = await admin.auth.admin.getUserById(
          membership.user_id
        );
        if (error) throw error;

        return {
          userId: membership.user_id,
          email: data.user.email ?? "Unknown email",
          role: membership.role,
        };
      })
    );

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Could not load team members:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load team members." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown };
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const { user, businessId, error: accountError } = await getOwnedBusiness();
    if (accountError === "unauthenticated") {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    if (accountError === "no_business" || !businessId || !user) {
      return NextResponse.json(
        { error: "Create a business before inviting team members." },
        { status: 400 }
      );
    }
    if (accountError === "not_owner") {
      return NextResponse.json(
        { error: "Only the business owner can invite team members." },
        { status: 403 }
      );
    }
    if (email === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "You are already the business owner." },
        { status: 400 }
      );
    }

    const subscription = await getActiveSubscription(businessId);
    if (subscription.plan !== "enterprise") {
      return NextResponse.json(
        { error: "Team invitations are available on the Enterprise plan." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { count, error: countError } = await admin
      .from("business_members")
      .select("user_id", { count: "exact", head: true })
      .eq("business_id", businessId);

    if (countError) throw countError;
    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: "Enterprise includes up to 10 members, including the owner." },
        { status: 409 }
      );
    }

    const { data: existingUserId, error: lookupError } = await admin.rpc(
      "lookup_auth_user_id_by_email",
      { p_email: email }
    );
    if (lookupError) throw lookupError;

    let invitedUserId: string | null = existingUserId;
    if (!invitedUserId) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (!siteUrl) {
        return NextResponse.json(
          { error: "Set NEXT_PUBLIC_SITE_URL to send team invitations." },
          { status: 503 }
        );
      }

      const { data, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: new URL("/login", siteUrl).toString(),
        });
      if (inviteError) throw inviteError;
      invitedUserId = data.user?.id ?? null;
    }

    if (!invitedUserId) {
      throw new Error("The invitation completed without returning a user account.");
    }

    const { data: existingMembership, error: membershipError } = await admin
      .from("business_members")
      .select("user_id")
      .eq("business_id", businessId)
      .eq("user_id", invitedUserId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (existingMembership) {
      return NextResponse.json({ message: "This user is already a team member." });
    }

    const { error: insertError } = await admin.from("business_members").insert({
      business_id: businessId,
      user_id: invitedUserId,
      role: "staff",
    });

    if (insertError) throw insertError;

    return NextResponse.json({ message: "Team member added successfully." });
  } catch (error) {
    console.error("Could not invite team member:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not invite this team member.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Choose a team member to remove." }, { status: 400 });
    }

    const { user, businessId, error: accountError } = await getOwnedBusiness();
    if (accountError === "unauthenticated") {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    if (accountError || !businessId || !user) {
      return NextResponse.json({ error: "Business owner access is required." }, { status: 403 });
    }
    if (userId === user.id) {
      return NextResponse.json(
        { error: "The business owner cannot remove themselves." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("business_members")
      .delete()
      .eq("business_id", businessId)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ message: "Team member removed." });
  } catch (error) {
    console.error("Could not remove team member:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove this team member." },
      { status: 500 }
    );
  }
}
