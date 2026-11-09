//#region src/card/panel.ts
var e = "/reolink-viewer";
function t(t) {
	history.pushState(null, "", `${e}${t}`), window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !1 } }));
}
//#endregion
export { t as n, e as t };
