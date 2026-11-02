//#region src/card/config.ts
var e = "reolink-viewer-camera", t = `custom:${e}`, n = "reolink-viewer-camera-editor", r = "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/main/docs/user-guide.md#a-camera-on-a-dashboard", i = {
	quality: "sd",
	tap_action: "full_screen",
	show_name: !0,
	show_state: !0,
	fit: "cover"
}, a = {
	quality: ["sd", "hd"],
	tap_action: [
		"full_screen",
		"open_panel",
		"none"
	],
	fit: ["cover", "contain"]
}, o = ["show_name", "show_state"];
function s(e) {
	if (typeof e != "object" || !e) throw Error("The card needs its settings.");
	let n = e, r = n.camera;
	if (r != null && typeof r != "string") throw Error("camera: the camera's id, as the card's editor chooses it.");
	let s = {
		...i,
		type: typeof n.type == "string" ? n.type : t,
		...r ? { camera: r } : {}
	};
	for (let e of Object.keys(a)) {
		let t = n[e];
		if (t === void 0) continue;
		let r = a[e];
		if (typeof t != "string" || !r.includes(t)) throw Error(`${e}: one of ${r.join(", ")}.`);
		Object.assign(s, { [e]: t });
	}
	for (let e of o) {
		let t = n[e];
		if (t !== void 0) {
			if (typeof t != "boolean") throw Error(`${e}: true or false.`);
			s[e] = t;
		}
	}
	return s;
}
function c(e, t) {
	let n = {
		...e,
		...t,
		type: e.type ?? "custom:reolink-viewer-camera"
	};
	for (let [e, t] of Object.entries(i)) n[e] === t && Reflect.deleteProperty(n, e);
	return n.camera || Reflect.deleteProperty(n, "camera"), n;
}
var l = /* @__PURE__ */ new Map();
function u(e, t) {
	l.set(e, t);
}
function d(e) {
	let t = (e ? l.get(e) : void 0) ?? 16 / 9;
	return Math.max(2, Math.round(380 / t / 50));
}
var f = {
	columns: 12,
	rows: "auto",
	min_columns: 3,
	min_rows: 2
};
//#endregion
export { s as a, c, f as i, e as n, d as o, n as r, u as s, r as t };
