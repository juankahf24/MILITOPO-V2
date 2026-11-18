const access = new URL("../../../acceso.html", import.meta.url);

export async function endSession(signOutUser) {
  const finish = async () => {
    await signOutUser();
    try {
      localStorage.removeItem("militopo_v2_last_role");
      localStorage.removeItem("militopo_v2_auth_snapshot");
      sessionStorage.removeItem("militopo_v2_post_login_selector");
    } catch (_) {}
    globalThis.MILITOPO_V2_AUTH = null;
  };
  if (globalThis.MILITOPO_TRANSITION) {
    return globalThis.MILITOPO_TRANSITION.navigate(access, {replace:true, beforeLeave:finish});
  }
  await finish();
  location.replace(access.href);
  return true;
}
