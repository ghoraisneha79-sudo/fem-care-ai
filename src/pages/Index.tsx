
const signIn = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (authBusy) return;

  setAuthBusy(true);

  const form = new FormData(event.currentTarget);
  const address = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  try {
    if (!address || !password) {
      throw new Error("Please enter your email and password.");
    }

    if (registerMode) {
      const result = await authClient.signUp.email({
        email: address,
        password,
        name: address.split("@")[0],
      });

      if (result.error) {
        throw new Error(
          result.error.message || "Account creation failed."
        );
      }

      setRegisterMode(false);

      toast.success("Account created", {
        description:
          "If email verification is required, verify your email before signing in.",
      });

      return;
    }

    const result = await authClient.signIn.email({
      email: address,
      password,
    });

    if (result.error) {
      const message = result.error.message ||
        "Unable to sign in.";

      if (
        /email.*verif|verif.*email/i.test(message)
      ) {
        toast.error("Email verification required", {
          description:
            "Your account exists, but your email must be verified before login.",
        });
        return;
      }

      throw new Error(message);
    }

    const sessionResult = await authClient.getSession();

    if (sessionResult.error || !sessionResult.data?.user) {
      toast.error("Session not confirmed", {
        description:
          "Authentication succeeded, but no active session was found.",
      });
      return;
    }

    setAuthOpen(false);

    toast.success("Welcome back!", {
      description:
        `Signed in as ${sessionResult.data.user.email}`,
    });

    window.location.reload();

  } catch (error) {
    toast.error(
      registerMode
        ? "Account could not be created"
        : "Sign-in failed",
      {
        description: apiError(error),
      }
    );
  } finally {
    setAuthBusy(false);
  }
};
