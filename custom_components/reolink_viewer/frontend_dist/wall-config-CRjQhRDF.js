//#region src/card/wall-config.ts
var e = "reolink-viewer-wall", t = `custom:${e}`, n = "reolink-viewer-wall-editor", r = "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/main/docs/user-guide.md#the-wall-on-a-dashboard", i = { show_bar: !0 };
function a(e) {
	if (typeof e != "object" || !e) throw Error("The card needs its settings.");
	let n = e, r = n.layout;
	if (r != null && typeof r != "string") throw Error("layout: a saved layout's id, as the card's editor chooses it (none: every camera).");
	let a = n.show_bar;
	if (a !== void 0 && typeof a != "boolean") throw Error("show_bar: true or false.");
	return {
		type: typeof n.type == "string" ? n.type : t,
		...r ? { layout: r } : {},
		show_bar: a ?? i.show_bar
	};
}
function o(e, t) {
	let n = {
		...e,
		...t,
		type: e.type ?? "custom:reolink-viewer-wall"
	};
	return n.show_bar === i.show_bar && Reflect.deleteProperty(n, "show_bar"), n.layout || Reflect.deleteProperty(n, "layout"), n;
}
var s = {
	columns: 12,
	rows: 8,
	min_columns: 6,
	min_rows: 4
};
//#endregion
export { o as a, s as i, e as n, a as o, n as r, r as t };
