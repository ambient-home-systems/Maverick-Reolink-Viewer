//#region node_modules/@lit/reactive-element/css-tag.js
var e = globalThis, t = e.ShadowRoot && (e.ShadyCSS === void 0 || e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, n = Symbol(), r = /* @__PURE__ */ new WeakMap(), i = class {
	constructor(e, t, r) {
		if (this._$cssResult$ = !0, r !== n) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, n = this.t;
		if (t && e === void 0) {
			let t = n !== void 0 && n.length === 1;
			t && (e = r.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), t && r.set(n, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, a = (e) => new i(typeof e == "string" ? e : e + "", void 0, n), o = (e, ...t) => new i(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, n), s = (n, r) => {
	if (t) n.adoptedStyleSheets = r.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let t of r) {
		let r = document.createElement("style"), i = e.litNonce;
		i !== void 0 && r.setAttribute("nonce", i), r.textContent = t.cssText, n.appendChild(r);
	}
}, c = t ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return a(t);
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: ee, getOwnPropertySymbols: te, getPrototypeOf: ne } = Object, f = globalThis, re = f.trustedTypes, ie = re ? re.emptyScript : "", ae = f.reactiveElementPolyfillSupport, p = (e, t) => e, oe = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? ie : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, se = (e, t) => !l(e, t), ce = {
	attribute: !0,
	type: String,
	converter: oe,
	reflect: !1,
	useDefault: !1,
	hasChanged: se
};
Symbol.metadata ??= Symbol("metadata"), f.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var m = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = ce) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && u(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = d(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? ce;
	}
	static _$Ei() {
		if (this.hasOwnProperty(p("elementProperties"))) return;
		let e = ne(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(p("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(p("properties"))) {
			let e = this.properties, t = [...ee(e), ...te(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(1 / 0).reverse());
			for (let e of n) t.unshift(c(e));
		} else e !== void 0 && t.push(c(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return s(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? oe : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? oe : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? se)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
m.elementStyles = [], m.shadowRootOptions = { mode: "open" }, m[p("elementProperties")] = /* @__PURE__ */ new Map(), m[p("finalized")] = /* @__PURE__ */ new Map(), ae?.({ ReactiveElement: m }), (f.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var le = globalThis, ue = (e) => e, h = le.trustedTypes, de = h ? h.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, fe = "$lit$", g = `lit$${Math.random().toFixed(9).slice(2)}$`, pe = "?" + g, me = `<${pe}>`, _ = document, v = () => _.createComment(""), y = (e) => e === null || typeof e != "object" && typeof e != "function", he = Array.isArray, ge = (e) => he(e) || typeof e?.[Symbol.iterator] == "function", b = "[ 	\n\f\r]", x = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, _e = /-->/g, ve = />/g, S = RegExp(`>|${b}(?:([^\\s"'>=/]+)(${b}*=${b}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), ye = /'/g, be = /"/g, xe = /^(?:script|style|textarea|title)$/i, Se = (e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}), C = Se(1), w = Se(2), T = Symbol.for("lit-noChange"), E = Symbol.for("lit-nothing"), Ce = /* @__PURE__ */ new WeakMap(), D = _.createTreeWalker(_, 129);
function we(e, t) {
	if (!he(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return de === void 0 ? t : de.createHTML(t);
}
var Te = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = x;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === x ? c[1] === "!--" ? o = _e : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = S) : (xe.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = S) : o = ve : o === S ? c[0] === ">" ? (o = i ?? x, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? S : c[3] === "\"" ? be : ye) : o === be || o === ye ? o = S : o === _e || o === ve ? o = x : (o = S, i = void 0);
		let d = o === S && e[t + 1].startsWith("/>") ? " " : "";
		a += o === x ? n + me : l >= 0 ? (r.push(s), n.slice(0, l) + fe + n.slice(l) + g + d) : n + g + (l === -2 ? t : d);
	}
	return [we(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, Ee = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = Te(t, n);
		if (this.el = e.createElement(l, r), D.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = D.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(fe)) {
					let t = u[o++], n = i.getAttribute(e).split(g), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? ke : r[1] === "?" ? Ae : r[1] === "@" ? je : k
					}), i.removeAttribute(e);
				} else e.startsWith(g) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (xe.test(i.tagName)) {
					let e = i.textContent.split(g), t = e.length - 1;
					if (t > 0) {
						i.textContent = h ? h.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], v()), D.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], v());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === pe) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(g, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += g.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = _.createElement("template");
		return n.innerHTML = e, n;
	}
};
function O(e, t, n = e, r) {
	if (t === T) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = y(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = O(e, i._$AS(e, t.values), i, r)), t;
}
var De = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? _).importNode(t, !0);
		D.currentNode = r;
		let i = D.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new Oe(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Me(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = D.nextNode(), a++);
		}
		return D.currentNode = _, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, Oe = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = E, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = O(this, e, t), y(e) ? e === E || e == null || e === "" ? (this._$AH !== E && this._$AR(), this._$AH = E) : e !== this._$AH && e !== T && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ge(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== E && y(this._$AH) ? this._$AA.nextSibling.data = e : this.T(_.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = Ee.createElement(we(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new De(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = Ce.get(e.strings);
		return t === void 0 && Ce.set(e.strings, t = new Ee(e)), t;
	}
	k(t) {
		he(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(v()), this.O(v()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = ue(e).nextSibling;
			ue(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, k = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = E, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = E;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = O(this, e, t, 0), a = !y(e) || e !== this._$AH && e !== T, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = O(this, r[n + o], t, o), s === T && (s = this._$AH[o]), a ||= !y(s) || s !== this._$AH[o], s === E ? e = E : e !== E && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === E ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, ke = class extends k {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === E ? void 0 : e;
	}
}, Ae = class extends k {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== E);
	}
}, je = class extends k {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = O(this, e, t, 0) ?? E) === T) return;
		let n = this._$AH, r = e === E && n !== E || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== E && (n === E || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Me = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		O(this, e);
	}
}, Ne = le.litHtmlPolyfillSupport;
Ne?.(Ee, Oe), (le.litHtmlVersions ??= []).push("3.3.3");
var Pe = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new Oe(t.insertBefore(v(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Fe = globalThis, A = class extends m {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Pe(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return T;
	}
};
A._$litElement$ = !0, A.finalized = !0, Fe.litElementHydrateSupport?.({ LitElement: A });
var Ie = Fe.litElementPolyfillSupport;
Ie?.({ LitElement: A }), (Fe.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var Le = (e) => e.callWS({ type: "reolink_viewer/devices" }), Re = (e, t) => e.callWS({
	type: "reolink_viewer/device",
	device_id: t
}), ze = /* @__PURE__ */ new WeakMap();
function Be(e) {
	let t = ze.get(e.connection);
	return t || (t = e.callWS({ type: "reolink_viewer/catalog" }), ze.set(e.connection, t), t.catch(() => ze.delete(e.connection))), t;
}
var Ve = (e, t) => e.callWS({
	type: "config/entity_registry/update",
	entity_id: t,
	disabled_by: null
});
function He(e, t, n) {
	let r, i = !1, a = () => void 0, o = () => {
		let e = r;
		r = void 0, e && e().catch(() => void 0);
	};
	return {
		result: new Promise((s, c) => {
			a = c, e.connection.subscribeMessage((e) => {
				if (!i) switch (e.type) {
					case "progress":
						n(e.message);
						return;
					case "result":
						i = !0, o(), s(e.report);
						return;
					case "error":
						i = !0, o(), c(Error(e.message));
						return;
				}
			}, {
				type: "reolink_viewer/probe",
				...t
			}).then((e) => {
				r = e, i && o();
			}).catch((e) => {
				i = !0, c(j(e));
			});
		}),
		cancel: () => {
			i || (i = !0, o(), a(/* @__PURE__ */ Error("Probe cancelled")));
		}
	};
}
function j(e) {
	return e instanceof Error ? e : typeof e == "object" && e && "message" in e ? Error(String(e.message)) : Error(String(e));
}
var Ue = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/timeline/days",
	device_id: t,
	year: n,
	month: r
}), We = (e, t, n, r = 0) => e.callWS({
	type: "reolink_viewer/timeline/day",
	device_id: t,
	date: n,
	...r > 0 ? { max_age: r } : {}
}), Ge = (e, t = {}) => e.callWS({
	type: "reolink_viewer/events/recent",
	...t.date ? { date: t.date } : {},
	...t.maxAge ? { max_age: t.maxAge } : {},
	...t.background ? { background: !0 } : {}
}), Ke = (e, t, n) => e.callWS({
	type: "reolink_viewer/events/days",
	year: t,
	month: n
}), qe = (e, t, n) => e.callWS({
	type: "reolink_viewer/events/seen",
	camera_id: t,
	start: n
}), Je = (e) => e.callWS({
	type: "reolink_viewer/events/seen",
	all: !0
}), Ye = (e) => e.callWS({ type: "reolink_viewer/timeline/warm" }), Xe = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/playback/url",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	progressive: n,
	...r === void 0 ? {} : { at: Math.round(r) }
}), Ze = (e, t, n) => e.callWS({
	type: "reolink_viewer/playback/mse",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	...n === void 0 ? {} : { at: Math.round(n) }
});
function Qe(e) {
	return e.split("?")[0]?.split("/").at(-1) ?? "";
}
var $e = (e, t) => e.callWS({
	type: "reolink_viewer/playback/release",
	tokens: t
}), et = (e, t) => e.callWS({
	type: "reolink_viewer/playback/cache_status",
	token: t
}), tt = (e, t) => e.callWS({
	type: "reolink_viewer/playback/prefetch",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream
}), nt = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/thumbnail/urls",
	device_id: t,
	times: n,
	bucket: r
}), rt = (e, t) => e.callWS({
	type: "reolink_viewer/playback/media_info",
	device_id: t
}), it = (e) => e.callWS({ type: "reolink_viewer/live/status" }), at = (e) => e.callWS({ type: "reolink_viewer/live/cameras" }), M = (e) => ({
	connection_id: e.connectionId,
	stream: e.stream
}), ot = (e, t) => e.callWS({
	type: "reolink_viewer/live/mse",
	...M(t)
}), st = (e, t) => e.callWS({
	type: "reolink_viewer/live/frame",
	...M(t)
}), ct = (e, t) => e.callWS({
	type: "reolink_viewer/live/state",
	...M(t)
}), lt = (e) => e.callWS({ type: "reolink_viewer/live/soak" }), ut = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/soak/count",
	device: t,
	...n
}), dt = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/soak/start",
	device: t,
	grid_open: n
}), ft = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/preload",
	...M(t),
	enabled: n
}), pt = (e) => e.callWS({ type: "web_rtc/ice_servers" }), mt = (e, t, n, r) => e.connection.subscribeMessage(r, {
	type: "reolink_viewer/live/webrtc",
	...M(t),
	offer: n
}), ht = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/candidate",
	session_id: t,
	candidate: n
}), gt = (e, t) => e.connection.subscribeMessage(t, { type: "reolink_viewer/live/images" }), _t = (e, t, n, r = {}) => e.connection.subscribeMessage(n, {
	type: "reolink_viewer/live/capacity",
	host_id: t,
	...r
}), vt = {
	person: w`<circle cx="12" cy="7" r="3.2" /><path d="M5.5 20.5v-1.8a6.5 6.5 0 0 1 13 0v1.8" />`,
	visitor: w`<path d="M6.2 16.5v-5.3a5.8 5.8 0 0 1 11.6 0v5.3l1.7 1.8H4.5z" /><path d="M10 21a2.1 2.1 0 0 0 4 0" />`,
	vehicle: w`<path d="M3.5 16.5v-3.8l2.1-5a1.6 1.6 0 0 1 1.5-1h9.8a1.6 1.6 0 0 1 1.5 1l2.1 5v3.8z" /><path d="M3.8 12.5h16.4" /><circle cx="7.6" cy="16.6" r="1.9" /><circle cx="16.4" cy="16.6" r="1.9" />`,
	animal: w`<circle cx="6.6" cy="10" r="1.7" /><circle cx="10" cy="6.4" r="1.7" /><circle cx="14" cy="6.4" r="1.7" /><circle cx="17.4" cy="10" r="1.7" /><path d="M8.3 17.6c0-3.1 1.7-5.6 3.7-5.6s3.7 2.5 3.7 5.6c0 1.6-1.3 2.1-2.3 1.7a3.7 3.7 0 0 0-2.8 0c-1 .4-2.3-.1-2.3-1.7z" />`,
	package: w`<path d="M4 7.6 12 3.6l8 4v8.8l-8 4-8-4z" /><path d="m4 7.6 8 4 8-4M12 11.6v8.8M8 5.6l8 4" />`,
	motion: w`<path d="M3 12.5h3.6l2.3-5.6 4.2 11 2.4-5.4H21" />`,
	picture: w`<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />`,
	back: w`<path d="M19 12H5.5M11 5.5 4.5 12l6.5 6.5" />`,
	chevron: w`<path d="m9.5 5.5 6.5 6.5-6.5 6.5" />`,
	chevronBack: w`<path d="m14.5 5.5-6.5 6.5 6.5 6.5" />`,
	chevronDown: w`<path d="m5.5 9.5 6.5 6.5 6.5-6.5" />`,
	close: w`<path d="M6 6l12 12M18 6 6 18" />`,
	info: w`<circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" />`,
	enterFull: w`<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />`,
	exitFull: w`<path d="M9 4.5V9H4.5M15 4.5V9h4.5M19.5 15H15v4.5M4.5 15H9v4.5" />`,
	play: w`<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />`,
	pause: w`<path d="M8.5 5.5v13M15.5 5.5v13" />`,
	previous: w`<path d="M6 5.5v13M18.5 5.5 9 12l9.5 6.5z" />`,
	next: w`<path d="M18 5.5v13M5.5 5.5 15 12l-9.5 6.5z" />`,
	plus: w`<path d="M12 5v14M5 12h14" />`,
	minus: w`<path d="M5 12h14" />`,
	refresh: w`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" />`,
	download: w`<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />`,
	pip: w`<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><rect x="11.5" y="11.5" width="6" height="4.5" fill="currentColor" />`,
	external: w`<path d="M13.5 4.5h6v6M19.5 4.5l-8 8" /><path d="M17.5 13.5v5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h5" />`
};
function N(e) {
	return C`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${vt[e]}</svg>`;
}
//#endregion
//#region src/integration.ts
function yt(e) {
	if (e?.degraded) return e.compat.ok ? !e.hosts.length && !e.cameras.length ? {
		kind: "none",
		title: "No Reolink devices yet",
		text: "Set up your cameras or NVR in Home Assistant's Reolink integration first.",
		advice: "Settings → Devices & services → Add integration → Reolink. They appear here once it has loaded them."
	} : {
		kind: "stopped",
		title: "The Reolink integration is not running",
		text: "Home Assistant's Reolink integration has not loaded your cameras or NVR, so Reolink Viewer cannot reach them.",
		advice: "Check it under Settings → Devices & services → Reolink: it may be waiting for a camera or NVR to come back online. Live view, recordings and events come back once it runs."
	} : {
		kind: "changed",
		title: "Reolink Viewer needs an update",
		text: "A Home Assistant update changed its Reolink integration, and this version of Reolink Viewer cannot work with it.",
		advice: "Update Reolink Viewer in HACS when a new version is out. Until then, live view, recordings and events are off here. Your cameras keep recording, the Reolink app still works, and your devices and their settings are still here.",
		technical: bt(e.compat)
	};
}
function bt(e) {
	return [...e.errors, ...e.reolink_aio_version ? [`reolink-aio ${e.reolink_aio_version}`] : []].join("\n");
}
function xt(e, t) {
	return /not loaded/i.test(e) ? {
		text: `${t} could not load: Reolink Viewer is not running.`,
		advice: "Check it under Settings → Devices & services, then try again."
	} : /internals changed|incompatible/i.test(e) ? {
		text: `${t} could not load: Reolink Viewer needs an update to work with this Home Assistant release.`,
		advice: "Update it in HACS when a new version is out."
	} : /unknown command/i.test(e) ? {
		text: `${t} could not load: Reolink Viewer was updated, but Home Assistant has not restarted since.`,
		advice: "Restart Home Assistant, then reload this page."
	} : {
		text: `${t} could not load from Home Assistant.`,
		advice: "Check the connection to Home Assistant, then try again."
	};
}
//#endregion
//#region src/live/check-util.ts
var St = "Live check · ", Ct = [
	"avc1.640029",
	"avc1.64002A",
	"avc1.640033",
	"hvc1.1.6.L153.B0",
	"mp4a.40.2",
	"mp4a.40.5",
	"flac",
	"opus"
];
function wt(e, t = !1) {
	return Ct.filter((n) => (!t || /^(avc1|hvc1)\./.test(n)) && e(`video/mp4; codecs="${n}"`)).join(",");
}
function Tt(e) {
	return [/live check (v[\w.-]+)/.exec(e)?.[1], /^Browser: (.+?)(?: · |$)/m.exec(e)?.[1]].filter((e) => e !== void 0).join(" · ");
}
function Et(e) {
	let t = 0, n = 0, r = !1;
	for (let i of e) for (let e of Array.isArray(i.urls) ? i.urls : [i.urls]) /^turns?:/i.test(e) ? n += 1 : /^stun:/i.test(e) && (t += 1), /nabucasa|nabu\.casa/i.test(e) && (r = !0);
	return [`${t} STUN`, `${n} TURN${r && n ? " (Nabu Casa)" : ""}`].join(", ");
}
function Dt(e) {
	return e.map((e) => ({
		urls: e.urls,
		...e.username ? { username: e.username } : {},
		...e.credential ? { credential: e.credential } : {}
	}));
}
function Ot(e) {
	let t = /* @__PURE__ */ new Map();
	e.forEach((e) => {
		t.set(String(e.id), e);
	});
	let n;
	for (let e of t.values()) e.type === "transport" && typeof e.selectedCandidatePairId == "string" && (n = t.get(e.selectedCandidatePairId));
	n ??= [...t.values()].find((e) => e.type === "candidate-pair" && e.nominated && e.state === "succeeded");
	let r = {}, i = (e) => {
		let n = t.get(String(e));
		if (n) return `${typeof n.candidateType == "string" ? n.candidateType : "?"}/${typeof n.protocol == "string" ? n.protocol : "?"}${typeof n.relayProtocol == "string" ? ` (TURN over ${n.relayProtocol})` : ""}`;
	};
	if (n) {
		let e = i(n.localCandidateId), t = i(n.remoteCandidateId);
		e && (r.local = e), t && (r.remote = t), typeof n.currentRoundTripTime == "number" && (r.rttMs = Math.round(n.currentRoundTripTime * 1e3));
	}
	for (let e of t.values()) if (e.type === "inbound-rtp" && e.kind === "video") {
		let n = t.get(String(e.codecId));
		n && typeof n.mimeType == "string" && (r.codec = n.mimeType.replace(/^video\//, "").toLowerCase()), typeof e.frameWidth == "number" && (r.width = e.frameWidth), typeof e.frameHeight == "number" && (r.height = e.frameHeight), typeof e.framesDecoded == "number" && (r.framesDecoded = e.framesDecoded);
	}
	return r;
}
function kt(e) {
	return e === void 0 ? "–" : `${(e / 1e3).toFixed(2)} s`;
}
function At(e) {
	if (!e.length) return;
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 ? t[n] : ((t[n - 1] ?? 0) + (t[n] ?? 0)) / 2;
}
function jt(e) {
	if (!e) return "";
	let t = [
		e.key_interval_ms === null ? void 0 : `key frames every ${kt(e.key_interval_ms)}`,
		e.parameter_sets === null ? void 0 : `parameter sets: ${e.parameter_sets}`,
		e.frame_order ? `frame order: ${e.frame_order}` : void 0,
		e.ends ? `feed ended ${String(e.ends)}× (${e.last_end ?? "?"})` : void 0,
		`feed opened ${kt(e.age_ms)} before`
	].filter(Boolean);
	return t.length ? `; ${t.join("; ")}` : "";
}
function Mt(e, t) {
	if (!t) return e;
	let n = [
		t.codec,
		t.width && t.height ? `${t.width}×${t.height}` : void 0,
		t.frame_rate ? `${t.frame_rate} fps` : void 0,
		t.bit_rate ? `${t.bit_rate} kbps` : void 0
	].filter(Boolean);
	return n.length ? `${e} (${n.join(", ")})` : e;
}
function Nt(e) {
	let t = [], n = typeof e.fill == "string" ? e.fill : e.fill ? `ch${e.fill.channel + 1}, ${Math.round(e.fill.duration_s / 60)} min recording` : "not run";
	e.warm_set_aside && t.push(`  cameras kept warm, set aside while it ran: ${String(e.warm_set_aside)}`), t.push(`  logged-in clients (GetOnline) before: ${e.online_users_before}, after: ${e.online_users_after}`), t.push(`  download: ${n}${e.fill_alone_mbit_s == null ? "" : `, alone ${e.fill_alone_mbit_s} Mbit/s`}`);
	for (let { camera: n, why: r } of e.main_left_out ?? []) t.push(`  main left out: ${n} main (${r}, on its own)`);
	for (let n of e.levels) {
		let e = n.first_frame_s == null ? "" : `, first frame ${n.first_frame_s} s`, r = n.fill ? `, download ${n.fill.mbit_s ?? "?"} Mbit/s${n.fill.error ? ` (${n.fill.error})` : ""}` : "", i = n.streams.map((e) => {
			let t = e.expected_fps ? `${e.fps}/${e.expected_fps}` : `${e.fps}`, n = e.longest_gap_s > 1 ? ` gap ${e.longest_gap_s} s` : "";
			return `${e.stream} ${t} fps${n}${e.error ? ` (${e.error})` : ""}`;
		}).join("; "), a = n.online_users == null ? "" : ` · clients ${n.online_users}`;
		t.push(`  L${n.level} + ${n.added}${e}${r}${a}: ${i}`);
	}
	let r = e.verdict;
	return t.push(r.first_failing_level === null ? "  verdict: every level kept up" : `  verdict: level ${r.first_failing_level} fails or slows down: ${r.reasons.join("; ")}`), t;
}
function Pt(e, t) {
	let n = new URL(e, t);
	return n.protocol = n.protocol === "https:" ? "wss:" : "ws:", n.toString();
}
//#endregion
//#region src/live/data.ts
var Ft = class {
	_host;
	cameras;
	images = {};
	iceServers;
	error;
	_hass;
	_connected = !1;
	_started = !1;
	_run = 0;
	_unsubscribe;
	constructor(e) {
		this._host = e, e.addController(this);
	}
	set hass(e) {
		this._hass = e, this._maybeLoad();
	}
	hostConnected() {
		this._connected = !0, this._maybeLoad();
	}
	hostDisconnected() {
		this._connected = !1, this._reset();
	}
	reload() {
		this._reset(), this.error = void 0, this._maybeLoad();
	}
	_reset() {
		this._started = !1, this._run += 1, this._unsubscribe?.().catch(() => void 0), this._unsubscribe = void 0;
	}
	_maybeLoad() {
		this._hass && this._connected && !this._started && (this._started = !0, this._load(this._hass, this._run));
	}
	async _load(e, t) {
		let n = gt(e, (e) => {
			t === this._run && (this.images = {
				...this.images,
				...e.images
			}, this._host.requestUpdate());
		}), r = pt(e).then(Dt, () => []);
		try {
			let [i, { cameras: a }, o] = await Promise.all([
				n,
				at(e),
				r
			]);
			if (t !== this._run) {
				i().catch(() => void 0);
				return;
			}
			this._unsubscribe = i, this.cameras = a, this.iceServers = o, this.error = void 0;
		} catch (e) {
			if (n.then((e) => e()).catch(() => void 0), t !== this._run) return;
			this.error = j(e).message;
		}
		this._host.requestUpdate();
	}
};
function It(e, t) {
	let n = t.keep_warm_entity;
	return n && e?.states[n]?.state === "on" ? !0 : P(t)?.streams.sub?.warm === !0;
}
function Lt(e, t) {
	let n = t?.status_entity, r = n ? e?.states[n] : void 0;
	if (r?.state !== "unavailable") return;
	let i = Date.parse(r.last_changed);
	return Number.isNaN(i) ? Date.now() : i;
}
function P(e) {
	return e.connections.find((e) => e.via === "nvr") ?? e.connections[0];
}
function Rt(e, t) {
	return e.find((e) => e.id === t || e.connections.some((e) => e.connection_id === t));
}
//#endregion
//#region src/live/soak-tally.ts
var zt = 6e4, F = new class {
	_device;
	_now;
	_opens = 0;
	_openMs = 0;
	_visibleMs = 0;
	_tiles = /* @__PURE__ */ new Map();
	_openSince;
	_visibleSince;
	_timer;
	_sending = Promise.resolve();
	constructor(e = () => Bt(navigator.userAgent), t = () => Date.now()) {
		this._device = e, this._now = t;
	}
	get open() {
		return this._openSince !== void 0;
	}
	opened(e, t) {
		let n = this._now();
		this._opens += 1, this._openSince = n, this._visibleSince = t ? n : void 0, clearInterval(this._timer), this._timer = setInterval(() => {
			let t = e();
			t && this.flush(t);
		}, zt);
	}
	closed() {
		this._accrue(), this._openSince = void 0, this._visibleSince = void 0, clearInterval(this._timer), this._timer = void 0;
	}
	visibility(e) {
		this.open && (this._accrue(), this._visibleSince = e ? this._now() : void 0);
	}
	count(e, t) {
		let n = this._tiles.get(e);
		n || (n = {
			plays: 0,
			drops: 0,
			failures: 0
		}, this._tiles.set(e, n)), n[t] += 1;
	}
	discard() {
		this._accrue(), this._take();
	}
	flush(e) {
		return this._sending = this._sending.then(() => this._send(e)), this._sending;
	}
	async _send(e) {
		this._accrue();
		let t = this._take();
		if (t) try {
			await ut(e, this._device(), t);
		} catch {
			this._putBack(t);
		}
	}
	_accrue() {
		let e = this._now();
		this._openSince !== void 0 && (this._openMs += e - this._openSince, this._openSince = e), this._visibleSince !== void 0 && (this._visibleMs += e - this._visibleSince, this._visibleSince = e);
	}
	_take() {
		let e = {
			opens: this._opens,
			open_ms: Math.round(this._openMs),
			visible_ms: Math.round(this._visibleMs),
			tiles: [...this._tiles].map(([e, t]) => ({
				camera: e,
				...t
			}))
		};
		return this._opens = 0, this._openMs = 0, this._visibleMs = 0, this._tiles = /* @__PURE__ */ new Map(), !e.opens && !e.open_ms && !e.visible_ms && !e.tiles.length ? void 0 : e;
	}
	_putBack(e) {
		this._opens += e.opens, this._openMs += e.open_ms, this._visibleMs += e.visible_ms;
		for (let { camera: t, plays: n, drops: r, failures: i } of e.tiles) {
			let e = this._tiles.get(t) ?? {
				plays: 0,
				drops: 0,
				failures: 0
			};
			this._tiles.set(t, {
				plays: e.plays + n,
				drops: e.drops + r,
				failures: e.failures + i
			});
		}
	}
}();
function Bt(e) {
	let t = /iPhone/.test(e) ? "iPhone" : /iPad/.test(e) ? "iPad" : /Android/.test(e) ? "Android" : /Macintosh|Mac OS X/.test(e) ? "Mac" : /Windows/.test(e) ? "Windows" : /Linux|X11/.test(e) ? "Linux" : "Browser", n = /Home ?Assistant\//.test(e) ? "Home Assistant app" : /Edg(A|iOS)?\//.test(e) ? "Edge" : /Firefox\/|FxiOS\//.test(e) ? "Firefox" : /Chrome\/|CriOS\//.test(e) ? "Chrome" : /Safari\//.test(e) ? "Safari" : void 0;
	return n ? `${t} · ${n}` : t;
}
//#endregion
//#region src/version.ts
var Vt = "0.34.1", Ht = "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer", Ut = {
	guide: ["user-guide"],
	troubleshooting: ["troubleshooting"],
	cameras: ["cameras"],
	changed: ["troubleshooting", "reolink-viewer-needs-an-update"],
	stopped: ["troubleshooting", "the-reolink-integration-is-not-running"],
	none: ["troubleshooting", "no-reolink-devices-yet"],
	loading: ["troubleshooting", "a-page-could-not-load"],
	recordings: ["troubleshooting", "recordings-and-events"]
};
function Wt(e) {
	let [t, n] = Ut[e];
	return `${Ht}/blob/v${Vt}/docs/${t}.md${n ? `#${n}` : ""}`;
}
//#endregion
//#region src/problem.ts
function I(e, t, n = {}) {
	return C`<div class="banner ${n.kind ?? "error"} problem" role="alert">
    <strong>${e.text}</strong>${e.advice ? C` ${e.advice}` : E}
    ${n.action ?? E} ${n.help ? Gt(n.help) : E}
    ${t ? C`<details>
          <summary>Details</summary>
          <span class="technical">${t}</span>
        </details>` : E}
  </div>`;
}
function Gt(e, t = "More help") {
	return C`<a class="help-link" href=${Wt(e)} target="_blank" rel="noopener noreferrer"
    >${t}${N("external")}</a
  >`;
}
//#endregion
//#region src/styles.ts
var Kt = o`
  :host {
    --rv-rail: #1b2a6e;
    --rv-on-rail: #f4f4f1;
    --rv-platform: #1b2a6e;
    --rv-recording: #1b2a6e;
    --rv-on-rail-muted: #b4bbd3;
    --rv-board: #111418;
    --rv-on-board: #f4f4f1;
    --rv-on-board-muted: #a9b0c4;
    --rv-ground: #f4f4f1;
    --rv-ground-2: #e9e9e4;
    --rv-text: #111418;
    --rv-muted: #5d6370;
    --rv-rule: rgba(17, 20, 24, 0.14);
    --rv-rule-strong: #111418;
    --rv-red: #e10600;
    --rv-action: #2140c4;
    --rv-on-action: #ffffff;
    --rv-fault: #f2b100;
    --rv-on-fault: #111418;
    --rv-fault-ink: #8a5a00;
    --rv-font: Barlow, system-ui, sans-serif;
    --rv-font-cond: "Barlow Semi Condensed", Barlow, system-ui, sans-serif;
    --rv-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    color-scheme: light;
  }
  :host([dark]) {
    --rv-ground: #0e1530;
    --rv-ground-2: #18224a;
    --rv-text: #eef0f6;
    --rv-muted: #9aa3c0;
    --rv-rule: rgba(238, 240, 246, 0.16);
    --rv-rule-strong: #eef0f6;
    --rv-red: #ff4a3d;
    --rv-action: #8fa6ff;
    --rv-on-action: #0e1530;
    --rv-fault-ink: #f2b100;
    --rv-platform: #3349a8;
    --rv-recording: #5a6cb4;
    color-scheme: dark;
  }
  :host {
    --primary-color: var(--rv-action);
    --accent-color: var(--rv-action);
    --primary-text-color: var(--rv-text);
    --secondary-text-color: var(--rv-muted);
    --text-primary-color: var(--rv-on-action);
    --primary-background-color: var(--rv-ground);
    --secondary-background-color: var(--rv-ground-2);
    --card-background-color: var(--rv-ground);
    --divider-color: var(--rv-rule);
    --error-color: var(--rv-fault-ink);
    --warning-color: var(--rv-fault);
    --disabled-color: var(--rv-muted);
    --ha-card-border-radius: 2px;
    --ha-card-box-shadow: none;
    --code-font-family: var(--rv-mono);
    --switch-checked-track-color: var(--rv-action);
    --switch-checked-button-color: var(--rv-action);
  }
`, L = o`
  :host {
    color: var(--rv-text);
    font-family: var(--rv-font);
    font-variant-numeric: tabular-nums;
  }
  ::selection {
    background: var(--rv-action);
    color: var(--rv-on-action);
  }
  /* A section of a page: ruled at the top, no box. */
  .card {
    overflow-wrap: anywhere;
    border-top: 2px solid var(--rv-rule-strong);
    padding: 14px 0 4px;
  }
  h2 {
    margin: 0 0 6px;
    font-family: var(--rv-font-cond);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.15;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 17px;
    font-weight: 600;
  }
  p {
    max-width: 72ch;
  }
  .muted {
    color: var(--rv-muted);
  }
  .small {
    font-size: 14px;
  }
  .badge {
    display: inline-block;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    padding: 0 7px;
    border: 1px solid var(--rv-rule);
    color: var(--rv-text);
    white-space: nowrap;
  }
  .badge.accent {
    background: var(--rv-action);
    border-color: var(--rv-action);
    color: var(--rv-on-action);
  }
  .badge.warning {
    background: var(--rv-fault);
    border-color: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  button {
    font: inherit;
    font-weight: 500;
    min-height: 36px;
    padding: 6px 14px;
    border-radius: 2px;
    border: 1px solid var(--rv-rule-strong);
    background: transparent;
    color: var(--rv-text);
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--rv-ground-2);
  }
  button.primary {
    background: var(--rv-action);
    border-color: var(--rv-action);
    color: var(--rv-on-action);
  }
  button.primary:hover:not(:disabled) {
    background: var(--rv-action);
    filter: brightness(1.1);
  }
  button.danger {
    background: var(--rv-fault);
    border-color: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  button.text,
  button.link {
    min-height: 0;
    background: transparent;
    border: none;
    color: var(--rv-action);
  }
  button.text {
    padding: 6px 4px;
  }
  button.link {
    padding: 0;
    text-align: left;
  }
  button.text:hover:not(:disabled),
  button.link:hover:not(:disabled) {
    background: transparent;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button svg {
    display: block;
    width: 20px;
    height: 20px;
  }
  button.with-icon {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :focus-visible {
    outline: 2px solid var(--rv-action);
    outline-offset: 2px;
  }
  input,
  select,
  textarea {
    font: inherit;
    color: var(--rv-text);
    background: var(--rv-ground);
    border: 1px solid var(--rv-rule-strong);
    border-radius: 2px;
    padding: 5px 8px;
    accent-color: var(--rv-action);
    caret-color: var(--rv-action);
  }
  input[type="checkbox"],
  input[type="radio"] {
    width: 18px;
    height: 18px;
    padding: 0;
    vertical-align: -3px;
  }
  a {
    color: var(--rv-action);
    text-underline-offset: 3px;
  }
  code,
  pre {
    font-family: var(--rv-mono);
  }
  .banner {
    padding: 12px 16px;
  }
  .banner.warning,
  .banner.error {
    background: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  .banner.warning button,
  .banner.error button {
    border-color: var(--rv-on-fault);
    color: var(--rv-on-fault);
  }
  .banner.warning a,
  .banner.error a {
    color: var(--rv-on-fault);
  }
  .banner.info {
    background: var(--rv-ground-2);
  }
  /* More help in the docs, which open in a new tab. */
  .help-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .help-link svg {
    width: 15px;
    height: 15px;
  }
  .problem .help-link {
    margin-left: 10px;
  }
  /* A problem's technical text, for support, under its plain words. */
  .problem details {
    margin-top: 6px;
    font-size: 13px;
  }
  .problem summary {
    cursor: pointer;
    font-weight: 500;
  }
  .problem .technical {
    display: block;
    margin-top: 4px;
    font-family: var(--rv-mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  /* Facts as ruled rows: a label, then its value. */
  dl.facts {
    display: grid;
    grid-template-columns: minmax(0, 10em) minmax(0, 1fr);
    margin: 8px 0;
    font-size: 15px;
  }
  dl.facts dt,
  dl.facts dd {
    margin: 0;
    padding: 8px 0;
    border-bottom: 1px solid var(--rv-rule);
  }
  dl.facts dt {
    padding-right: 20px;
    color: var(--rv-muted);
  }
  /* A form: each setting's label in a column, then its controls. */
  .form {
    display: grid;
    grid-template-columns: minmax(0, 12em) minmax(0, 1fr);
    border-top: 1px solid var(--rv-rule);
  }
  .form > .label {
    padding: 13px 16px 13px 0;
    border-bottom: 1px solid var(--rv-rule);
    color: var(--rv-muted);
    font-size: 15px;
  }
  .form > .field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 22px;
    min-width: 0;
    padding: 8px 0;
    border-bottom: 1px solid var(--rv-rule);
  }
  .form > .field.stack {
    flex-direction: column;
    align-items: flex-start;
  }
  .form select {
    min-height: 36px;
    max-width: 100%;
  }
  label.option {
    display: inline-flex;
    align-items: flex-start;
    gap: 10px;
    min-height: 32px;
    padding: 4px 0;
    box-sizing: border-box;
    line-height: 1.35;
  }
  label.option input {
    flex: none;
    margin: 0;
  }
  label.option.nested {
    margin-left: 28px;
  }
  @media (max-width: 600px) {
    .form {
      grid-template-columns: minmax(0, 1fr);
    }
    .form > .label {
      padding: 12px 0 0;
      border-bottom: none;
    }
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  /* A report to read and copy: a sheet under a rule. */
  pre.report {
    margin: 0;
    padding: 14px 16px;
    max-height: 480px;
    overflow: auto;
    background: var(--rv-ground-2);
    border-top: 2px solid var(--rv-rule-strong);
    font-size: 12.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: text;
    -webkit-user-select: text;
  }
  /* A disclosure: its drawn arrow turns when open. */
  summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    cursor: pointer;
    list-style: none;
    font-weight: 500;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary svg {
    flex: none;
    width: 16px;
    height: 16px;
  }
  details[open] > summary svg {
    transform: rotate(180deg);
  }
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--rv-rule) transparent;
  }
`, qt = {
	text: "Too many cameras are streaming from this recorder at once.",
	advice: "Close live view on another screen, or keep fewer cameras warm."
}, Jt = {
	text: "Live view's video service is not running.",
	advice: "Restart Home Assistant. If it stays, run the live check."
}, Yt = {
	text: "This browser cannot play this camera's video.",
	advice: "Try Chrome or Safari, or set the camera's video to H.264 in the Reolink app."
}, Xt = {
	text: "The camera refused Home Assistant's login.",
	advice: "Check its password in the Reolink integration."
}, Zt = {
	text: "It could not be woken.",
	advice: "It may be out of Wi-Fi range or low on battery. Try again in a moment."
}, Qt = {
	text: "The camera did not answer.",
	advice: "Check that it is powered and connected. It tries again by itself."
}, $t = {
	text: "No connection for live video could be made from here.",
	advice: "It tries again by itself. If it stays, run the live check on this device."
}, en = {
	text: "The camera sent no picture in time.",
	advice: "It may be busy, or far from its Wi-Fi. It tries again by itself."
}, tn = {
	text: "The camera's video stopped.",
	advice: "It starts again by itself."
}, nn = /did not give its stream address|i\/o timeout|timed? ?out|connection refused|no route to host|unreachable|dial tcp|\bEOF\b/i;
function rn(e, t = !1) {
	return /every stream slot|slots? .*in use/i.test(e) ? qt : /go2rtc (is not running|is not installed|did not start)|did not start within|exited with code/i.test(e) ? Jt : /refused (video|audio)|MSE refused|codec|no MediaSource|append failed|not supported/i.test(e) ? Yt : /\b401\b|unauthori[sz]ed|wrong (user|password)|password/i.test(e) ? Xt : t && (nn.test(e) || /no frame|closed the stream/i.test(e)) ? Zt : nn.test(e) ? Qt : /ICE failed|no path/i.test(e) ? $t : /no frame within|no new frame/i.test(e) ? en : /closed the stream|stream ended/i.test(e) ? tn : {
		text: "Live video stopped.",
		advice: "It tries again by itself. The ⓘ view has the details."
	};
}
//#endregion
//#region src/playback/codec.ts
function an() {
	let e = navigator.mediaCapabilities, t = e?.decodingInfo;
	return t ? t.bind(e) : void 0;
}
async function on(e, t = an()) {
	if (!e) return {
		main: !0,
		reason: "not tried yet: falls back to SD if this browser cannot play it"
	};
	if (!e.width || !e.height) return {
		main: !1,
		reason: "main stream size unknown"
	};
	let n = `${e.codec} at ${e.width}×${e.height}`;
	if (!t) return {
		main: !1,
		reason: "this browser cannot report what it decodes"
	};
	try {
		let r = await t({
			type: "file",
			video: {
				contentType: `video/mp4; codecs="${e.codec}"`,
				width: e.width,
				height: e.height,
				bitrate: 8e6,
				framerate: 25
			}
		});
		return r.supported ? r.smooth ? {
			main: !0,
			reason: `${n} is supported`
		} : {
			main: !1,
			reason: `${n} would not play smoothly here`
		} : {
			main: !1,
			reason: `this browser cannot decode ${n}`
		};
	} catch {
		return {
			main: !1,
			reason: `this browser cannot check ${n}`
		};
	}
}
function sn(e = navigator.userAgent) {
	return !(/AppleWebKit/.test(e) && !/Chrome|Chromium|CriOS|Edg|Android|FxiOS/.test(e));
}
//#endregion
//#region src/live/hd.ts
var cn = 4096, ln = Ct.find((e) => e.startsWith("hvc1.")) ?? "hvc1.1.6.L153.B0";
async function un(e, t = an()) {
	let n = (t) => e.streams.ext ? {
		stream: "ext",
		reason: `ext: ${t}`
	} : {
		stream: null,
		reason: `SD only: ${t}, and there is no ext stream`
	}, r = e.streams.main;
	if (!r) return n("no main stream");
	let i = r.encoding, a = i?.width ?? void 0, o = i?.height ?? void 0, s = a && o ? `${a}×${o}` : void 0;
	if (a && a > 4096) return n(`the main stream's ${s ?? `${a} pixels`} is wider than ${cn} pixels`);
	let c = i?.codec?.toLowerCase();
	if (c === "h264") return {
		stream: "main",
		reason: `main: H.264${s ? ` at ${s}` : ""}`
	};
	if (c !== "h265" && c !== "hevc") return n(`the main stream's codec is ${c ?? "unknown"}`);
	if (!a || !o || !s) return n("the main stream is H.265 at an unknown size");
	if (!t) return n("this browser cannot say whether it decodes H.265");
	try {
		let e = await t({
			type: "media-source",
			video: {
				contentType: `video/mp4; codecs="${ln}"`,
				width: a,
				height: o,
				bitrate: (i?.bit_rate ?? 8e3) * 1e3,
				framerate: i?.frame_rate ?? 25
			}
		});
		return e.supported ? e.smooth ? {
			stream: "main",
			reason: `main: H.265 at ${s}, smooth here`
		} : n(`H.265 at ${s} would not play smoothly here`) : n(`this browser cannot decode H.265 at ${s}`);
	} catch {
		return n(`this browser cannot check H.265 at ${s}`);
	}
}
//#endregion
//#region src/playback/mse-feeder.ts
var R = class extends Error {}, z = 4e3, dn = 2e4, fn = 12e4, pn = 16777216, mn = 50331648, hn = 1e3;
function gn() {
	let e = window;
	if (typeof e.ManagedMediaSource == "function") return "ManagedMediaSource";
	if (typeof e.MediaSource == "function") return "MediaSource";
}
function _n(e) {
	return window[e];
}
function vn(e) {
	let t = [];
	for (let n = 0; n < e.length; n += 1) {
		let r = {
			start: e.start(n),
			end: e.end(n)
		}, i = t.at(-1);
		i && r.start - i.end < .5 ? i.end = Math.max(i.end, r.end) : t.push(r);
	}
	return t;
}
function yn(e, t) {
	let n = Math.min(30 * Math.max(1, e), 240);
	return t > 0 ? Math.max(4, Math.min(n, mn / t)) : n;
}
function bn(e) {
	return e instanceof DOMException && e.name === "QuotaExceededError";
}
var xn = class {
	_video;
	_src;
	_onError;
	stats;
	_source;
	_buffer;
	_url;
	_pending;
	_next;
	_runStartS;
	_endS;
	_bytesPerSecond = 0;
	_ready = !1;
	_closed = !1;
	_listeners = [];
	constructor(e, t, n) {
		this._video = e, this._src = t, this._onError = n, this.stats = {
			api: "MediaSource",
			mime: "",
			windows: 0,
			bytes: 0,
			lastWaitMs: void 0,
			trims: 0,
			fetching: !1
		};
	}
	get closed() {
		return this._closed;
	}
	get around() {
		let e = this._video.currentTime, t = this._buffer ? this._rangeAt(e) : void 0;
		return t ? {
			ahead: t.end - e,
			behind: e - t.start
		} : {
			ahead: 0,
			behind: 0
		};
	}
	async start(e) {
		let t = gn();
		if (!t) throw new R("this browser has no MediaSource");
		this.stats.api = t;
		let n = _n(t), r = new n();
		this._source = r, this._video.disableRemotePlayback = !0, this._url = URL.createObjectURL(r);
		let i = new Promise((e) => {
			r.addEventListener("sourceopen", () => {
				e();
			}, { once: !0 });
		});
		if (this._video.src = this._url, await i, this._gone()) return;
		let a = await this._get("init"), o = a.headers.get("X-RV-Mime") ?? "";
		if (this.stats.mime = o, !o || !n.isTypeSupported(o)) throw new R(`MSE cannot play ${o || "this recording"}`);
		let s = new Uint8Array(await a.arrayBuffer());
		if (!this._gone()) {
			this._buffer = r.addSourceBuffer(o), this._src.durationMs > 0 && (r.duration = this._src.durationMs / 1e3);
			for (let e of [
				"timeupdate",
				"seeking",
				"ratechange",
				"progress"
			]) this._listen(this._video, e, this._pump);
			this._listen(this._video, "waiting", this._jumpGap), this._listen(r, "startstreaming", this._pump), this._listen(this._buffer, "updateend", this._pump), this._listen(this._buffer, "bufferedchange", this._pump), await this._append(s), await this._fetch({ at: e }, z, !0), e > 0 && this._video.currentTime === 0 && (this._video.currentTime = e / 1e3), this._ready = !0, this._pump();
		}
	}
	destroy() {
		this._closed = !0, this._pending?.controller.abort(), this._pending = void 0;
		for (let [e, t, n] of this._listeners) e.removeEventListener(t, n);
		this._listeners.length = 0, this._url && URL.revokeObjectURL(this._url);
	}
	_gone() {
		return this._closed;
	}
	_settle(e) {
		this._pending && this._pending.controller === e && (this._pending = void 0), this.stats.fetching = this._pending !== void 0;
	}
	_listen(e, t, n) {
		e.addEventListener(t, n), this._listeners.push([
			e,
			t,
			n
		]);
	}
	async _get(e, t) {
		let n = await this._src.fetch(`${this._src.base}/${e}`, t ? { signal: t } : {});
		if (!n.ok) {
			let e = await n.text().catch(() => "");
			throw e.startsWith("not playable as fragments") ? new R(e) : Error(`HTTP ${n.status}${e ? `: ${e}` : ""}`);
		}
		return n;
	}
	_pump = () => {
		let e = this._buffer;
		if (this._closed || !this._ready || !e) return;
		let t = this._video.currentTime, n = this._rangeAt(t);
		if (!n && this._endS !== void 0 && t >= this._endS - .5) return;
		let r = this._pending;
		if (r) {
			if (n || t >= r.fromS - .1 && t < r.toS) return;
			r.controller.abort(), this._pending = void 0;
		}
		if (e.updating) return;
		if (!n) {
			let e = this._next, n = this._runStartS;
			e && n !== void 0 && t >= e.atS - .5 && t < e.atS + .5 ? this._fetch({ first: e.index }, z, !1) : this._fetch({ at: t * 1e3 }, z, !1);
			return;
		}
		if (this._trim(t, n)) return;
		if (this._endS !== void 0 && n.end >= this._endS - .5) {
			this._endOfStream();
			return;
		}
		if (this._source?.streaming === !1 || n.end - t >= yn(this._video.playbackRate, this._bytesPerSecond)) return;
		let i = this._next, a = i && Math.abs(i.atS - n.end) < .5 ? { first: i.index } : { at: n.end * 1e3 }, o = Math.min(dn * Math.max(1, this._video.playbackRate), fn);
		this._fetch(a, o, !1);
	};
	async _fetch(e, t, n) {
		let r = new AbortController(), i = e.at === void 0 ? this._next?.atS ?? 0 : e.at / 1e3;
		this._pending = {
			controller: r,
			fromS: i,
			toS: i + t / 1e3
		}, this.stats.fetching = !0;
		let a = performance.now(), o = e.first === void 0 ? `at=${Math.round(e.at ?? 0)}` : `first=${e.first}`;
		try {
			let n = await this._get(`frags?${o}&ms=${Math.round(t)}&bytes=${pn}`, r.signal), i = new Uint8Array(await n.arrayBuffer());
			if (this._closed || r.signal.aborted) return;
			let s = (e) => Number(n.headers.get(`X-RV-${e}`)), [c, l, u, d] = [
				s("First"),
				s("Count"),
				s("Start"),
				s("End")
			];
			if (this.stats.windows += 1, this.stats.bytes += i.length, this.stats.lastWaitMs = performance.now() - a, l > 0 && (await this._append(i), (e.first === void 0 || this._runStartS === void 0) && (this._runStartS = u / 1e3), this._next = {
				index: c + l,
				atS: d / 1e3
			}, d > u && (this._bytesPerSecond = i.length * 1e3 / (d - u))), n.headers.get("X-RV-Last") === "1") {
				let t = e.first === void 0 ? void 0 : this._next?.atS;
				this._endS = l > 0 ? d / 1e3 : t ?? this._video.duration, this._endOfStream();
			}
			if (l === 0) {
				this._settle(r), setTimeout(this._pump, hn);
				return;
			}
		} catch (e) {
			if (this._closed || r.signal.aborted) return;
			if (n) throw e;
			this._closed = !0, this._onError(e instanceof Error ? e : Error(String(e)));
			return;
		} finally {
			this._settle(r);
		}
		this._pump();
	}
	async _append(e) {
		let t = this._buffer;
		if (t) {
			await this._idle(t);
			try {
				t.appendBuffer(e);
			} catch (n) {
				if (!bn(n)) throw n;
				await this._removeAllBut(t, 2), t.appendBuffer(e);
			}
			await this._idle(t);
		}
	}
	_idle(e) {
		return e.updating ? new Promise((t, n) => {
			let r = () => {
				e.removeEventListener("error", i), t();
			}, i = () => {
				e.removeEventListener("updateend", r), n(new R("append error"));
			};
			e.addEventListener("updateend", r, { once: !0 }), e.addEventListener("error", i, { once: !0 });
		}) : Promise.resolve();
	}
	async _removeAllBut(e, t) {
		let n = this._video.currentTime;
		for (let r of vn(e.buffered)) {
			let i = Math.max(r.start, n - t), a = Math.min(r.end, n + t);
			a <= i ? (this._remove(e, r.start, r.end), await this._idle(e)) : (i > r.start && (this._remove(e, r.start, i), await this._idle(e)), r.end > a && (this._remove(e, a, r.end), await this._idle(e)));
		}
		this.stats.trims += 1;
	}
	_trim(e, t) {
		let n = this._buffer;
		if (!n) return !1;
		for (let r of vn(n.buffered)) if (r.start !== t.start && (r.end < e - 30 || r.start > e + 240)) return this._remove(n, r.start, r.end), this.stats.trims += 1, !0;
		return e - t.start > 40 && (this._remove(n, t.start, e - 30), this.stats.trims += 1, !0);
	}
	_remove(e, t, n) {
		e.remove(t, n);
		let r = this._runStartS, i = this._next;
		r === void 0 || !i || n <= r || t >= i.atS || (this._runStartS = n >= i.atS - .5 ? void 0 : n);
	}
	_endOfStream() {
		let e = this._source, t = this._buffer;
		if (e && t && e.readyState === "open") {
			if (t.updating) t.addEventListener("updateend", () => {
				this._endOfStream();
			}, { once: !0 });
			else try {
				e.endOfStream();
			} catch {}
		}
	}
	_rangeAt(e) {
		let t = this._buffer;
		if (t) return vn(t.buffered).find((t) => e >= t.start - .05 && e < t.end);
	}
	_jumpGap = () => {
		let e = this._buffer;
		if (this._closed || !e) return;
		let t = this._video.currentTime, n = e.buffered;
		for (let e = 0; e < n.length; e += 1) {
			let r = n.start(e);
			if (r > t && r - t < .5) {
				this._video.currentTime = r + .001;
				return;
			}
		}
	};
}, Sn = 10, Cn = 2, wn = .5, Tn = 1e4;
function En(e) {
	return new Promise((t) => {
		let n = !1, r = () => {
			n || (n = !0, t(performance.now()));
		};
		typeof e.requestVideoFrameCallback == "function" ? e.requestVideoFrameCallback(() => {
			r();
		}) : e.addEventListener("playing", r, { once: !0 });
	});
}
var Dn = class {
	video;
	done;
	onEnd;
	t0 = performance.now();
	steps = {};
	closed = !1;
	_resolve;
	_timer;
	_playing = !1;
	_ended = !1;
	_lastFrame = 0;
	_stallTimer;
	constructor(e, t) {
		this.video = e, this.done = new Promise((e) => {
			this._resolve = e;
		}), this._timer = setTimeout(() => {
			this.fail(`no frame within ${Math.round(t / 1e3)} s`);
		}, t), e.muted = !0, e.playsInline = !0, e.autoplay = !0, En(e).then(async (t) => {
			if (this.closed) return;
			clearTimeout(this._timer), this._playing = !0, this._watchFrames();
			let n = await this.describe().catch(() => ({}));
			this._resolve({
				ok: !0,
				firstFrameMs: t - this.t0,
				steps: this.steps,
				...e.videoWidth ? {
					width: e.videoWidth,
					height: e.videoHeight
				} : {},
				...n
			});
		}, () => void 0);
	}
	step(e) {
		this.steps[e] ??= Math.round(performance.now() - this.t0);
	}
	fail(e, t = !1) {
		if (clearTimeout(this._timer), this._playing) {
			if (this._ended || this.closed) return;
			this._ended = !0, clearInterval(this._stallTimer), this.onEnd?.(e, t);
		} else this.describe().catch(() => ({})).then((t) => {
			this._resolve({
				ok: !1,
				error: e,
				steps: this.steps,
				...t
			});
		});
	}
	describe() {
		return Promise.resolve({});
	}
	play() {
		this.video.play().catch(() => void 0);
	}
	_watchFrames() {
		let e = this.video;
		this._lastFrame = performance.now();
		let t = () => {
			this._lastFrame = performance.now();
		};
		if (typeof e.requestVideoFrameCallback == "function") {
			let n = () => {
				t(), !this.closed && !this._ended && e.requestVideoFrameCallback(n);
			};
			e.requestVideoFrameCallback(n);
		} else e.addEventListener("timeupdate", t);
		this._stallTimer = setInterval(() => {
			performance.now() - this._lastFrame > 1e4 && this.fail(`no new frame for ${Math.round(Tn / 1e3)} s`);
		}, 1e3);
	}
	close() {
		this.closed = !0, clearTimeout(this._timer), clearInterval(this._stallTimer);
		let e = this.video;
		e.pause(), e.srcObject = null, e.removeAttribute("src"), e.load();
	}
}, On = class extends Dn {
	pc;
	async connect(e) {
		let t = new RTCPeerConnection({ iceServers: e });
		this.pc = t, t.addTransceiver("video", { direction: "recvonly" }), t.addTransceiver("audio", { direction: "recvonly" }), t.addEventListener("track", (e) => {
			this.step("track"), this.video.srcObject || (this.video.srcObject = e.streams[0] ?? new MediaStream([e.track]), this.play());
		}), t.addEventListener("iceconnectionstatechange", () => {
			let e = t.iceConnectionState;
			(e === "connected" || e === "completed") && this.step("connected"), e === "failed" && this.fail("ICE failed: no path between the browser and the server");
		}), t.addEventListener("icegatheringstatechange", () => {
			t.iceGatheringState === "complete" && this.step("gathered");
		});
		let n = await t.createOffer();
		return await t.setLocalDescription(n), this.step("offer"), n;
	}
	async describe() {
		return this.pc ? { pair: Ot(await this.pc.getStats()) } : {};
	}
	close() {
		super.close(), this.pc?.close();
	}
}, kn = class extends On {
	_hass;
	_unsubscribe;
	_session;
	_early = [];
	constructor(e, t, n, r, i) {
		super(t, i), this._hass = e, this._start(n, r);
	}
	async _start(e, t) {
		try {
			let n = await this.connect(t);
			this.pc?.addEventListener("icecandidate", (e) => {
				let t = e.candidate?.candidate;
				t && (this._session ? this._send(t) : this._early.push(t));
			}), this._unsubscribe = await mt(this._hass, e, n.sdp ?? "", (e) => {
				this._signal(e);
			}), this.closed && this._unsubscribe();
		} catch (e) {
			this.fail(j(e).message);
		}
	}
	async _send(e) {
		this._session && !this.closed && await ht(this._hass, this._session, e).catch(() => void 0);
	}
	async _signal(e) {
		let t = this.pc;
		if (t && !this.closed) try {
			switch (e.type) {
				case "session":
					this._session = e.session_id;
					for (let e of this._early.splice(0)) this._send(e);
					return;
				case "answer":
					this.step("answer"), await t.setRemoteDescription({
						type: "answer",
						sdp: e.sdp
					});
					return;
				case "candidate":
					e.candidate && await t.addIceCandidate({
						candidate: e.candidate,
						sdpMid: "0"
					});
					return;
				case "error":
					this.fail(e.message);
					return;
				case "closed":
					this.step("closed");
					return;
			}
		} catch (e) {
			this.fail(j(e).message);
		}
	}
	close() {
		super.close(), this._unsubscribe?.().catch(() => void 0);
	}
}, An = class extends On {
	_hass;
	_entityId;
	_unsubscribe;
	_session;
	_early = [];
	constructor(e, t, n, r) {
		super(t, r), this._hass = e, this._entityId = n, this._start();
	}
	async _start() {
		try {
			let e = await this._hass.callWS({
				type: "camera/webrtc/get_client_config",
				entity_id: this._entityId
			});
			this.step("config");
			let t = await this.connect(e.configuration.iceServers ?? []);
			this.pc?.addEventListener("icecandidate", (e) => {
				if (!e.candidate) return;
				let t = e.candidate.toJSON();
				this._session ? this._send(t) : this._early.push(t);
			}), this._unsubscribe = await this._hass.connection.subscribeMessage((e) => {
				this._signal(e);
			}, {
				type: "camera/webrtc/offer",
				entity_id: this._entityId,
				offer: t.sdp ?? ""
			}), this.closed && this._unsubscribe();
		} catch (e) {
			this.fail(j(e).message);
		}
	}
	async _send(e) {
		this._session && !this.closed && await this._hass.callWS({
			type: "camera/webrtc/candidate",
			entity_id: this._entityId,
			session_id: this._session,
			candidate: e
		}).catch(() => void 0);
	}
	async _signal(e) {
		let t = this.pc;
		if (t && !this.closed) try {
			switch (e.type) {
				case "session":
					this._session = e.session_id;
					for (let e of this._early.splice(0)) this._send(e);
					return;
				case "answer":
					this.step("answer"), await t.setRemoteDescription({
						type: "answer",
						sdp: e.answer
					});
					return;
				case "candidate":
					await t.addIceCandidate(e.candidate);
					return;
				case "error":
					this.fail(`${e.code}: ${e.message}`);
					return;
			}
		} catch (e) {
			this.fail(j(e).message);
		}
	}
	close() {
		super.close(), this._unsubscribe?.().catch(() => void 0);
	}
}, jn = class extends Dn {
	_hass;
	_base;
	_videoOnly;
	_ws;
	_buffer;
	_url;
	_queue = [];
	_api;
	_mime = "";
	_started = !1;
	constructor(e, t, n, r, i = location.href, a = !1) {
		super(t, r), this._hass = e, this._base = i, this._videoOnly = a, this._start(n);
	}
	async _start(e) {
		let t = gn();
		if (!t) {
			this.fail("this browser has no MediaSource");
			return;
		}
		this._api = t;
		let n = window[t];
		try {
			let { path: t } = await ot(this._hass, e);
			if (this.step("url"), this.closed) return;
			let r = new WebSocket(Pt(t, this._base));
			r.binaryType = "arraybuffer", this._ws = r, r.addEventListener("open", () => {
				this.step("open");
				let e = wt((e) => n.isTypeSupported(e), this._videoOnly);
				r.send(JSON.stringify({
					type: "mse",
					value: e
				}));
			}), r.addEventListener("message", (e) => {
				typeof e.data == "string" ? this._text(e.data, n) : this._media(e.data);
			}), r.addEventListener("close", () => {
				this.closed || this.fail("the server closed the stream", !0);
			});
		} catch (e) {
			this.fail(j(e).message);
		}
	}
	_text(e, t) {
		let n;
		try {
			n = JSON.parse(e);
		} catch {
			return;
		}
		if (n.type === "error") {
			this.fail(n.value ?? "error");
			return;
		}
		if (n.type !== "mse" || !n.value) return;
		this.step("mime"), this._mime = n.value;
		let r = new t();
		this.video.disableRemotePlayback = !0, this._url = URL.createObjectURL(r), r.addEventListener("sourceopen", () => {
			try {
				this._buffer = r.addSourceBuffer(n.value ?? ""), this._buffer.mode = "segments", this._buffer.addEventListener("updateend", () => {
					this._appended();
				}), this._next();
			} catch (e) {
				this.fail(`MSE refused ${n.value ?? ""}: ${j(e).message}`);
			}
		}, { once: !0 }), this.video.src = this._url;
	}
	_media(e) {
		this.step("first data"), this._queue.push(e), this._next();
	}
	_next() {
		let e = this._buffer;
		if (!e || e.updating || this.closed) return;
		let t = this._queue.shift();
		if (t) try {
			e.appendBuffer(t);
		} catch (e) {
			this.fail(`append failed: ${j(e).message}`);
		}
	}
	_appended() {
		let e = this._buffer, t = this.video;
		if (!e || this.closed) return;
		let n = e.buffered;
		if (n.length) {
			let r = n.start(0), i = n.end(n.length - 1);
			if (!this._started && i > r ? (this._started = !0, this.step("appended"), t.currentTime = Math.max(r, i - wn), this.play()) : i - t.currentTime > Cn && (t.currentTime = i - .3), t.currentTime - r > 20 && !e.updating) {
				e.remove(r, t.currentTime - Sn);
				return;
			}
		}
		this._next();
	}
	describe() {
		return Promise.resolve(this._api ? { mse: {
			api: this._api,
			mime: this._mime
		} } : {});
	}
	close() {
		this._ws?.close(), super.close(), this._url && URL.revokeObjectURL(this._url);
	}
}, Mn = {
	WebRTC: 15e3,
	MSE: 12e3
}, Nn = [
	1,
	2,
	5,
	10,
	30
], Pn = 12e5, Fn = 36e5, In = new class {
	_cuts = [];
	until = 0;
	note(e = Date.now()) {
		let t = this._cuts.at(-1);
		return t !== void 0 && e - t < 1e4 || (this._cuts = [...this._cuts.filter((t) => e - t < Pn), e], this._cuts.length < 2 || this.preferWebRtc(e)) ? !1 : (this.until = e + Fn, this._cuts = [], !0);
	}
	preferWebRtc(e = Date.now()) {
		return e < this.until;
	}
	giveUp() {
		this.until = 0;
	}
}(), Ln = 6048e5, Rn = "reolink-viewer.webrtc-blocked", zn = new class {
	_host;
	_storage;
	_until = 0;
	constructor(e = location.host, t = () => localStorage) {
		this._host = e, this._storage = t;
	}
	get until() {
		let e = this._read()[this._host];
		return Math.max(this._until, typeof e == "number" ? e : 0);
	}
	preferMse(e = Date.now()) {
		return e < this.until;
	}
	note(e = Date.now()) {
		return !this.preferMse(e) && (this._keep(e + Ln), !0);
	}
	works() {
		this.until && this._keep(0);
	}
	_keep(e) {
		this._until = e;
		try {
			let t = Object.fromEntries(Object.entries(this._read()).filter(([e]) => e !== this._host));
			e && (t[this._host] = e), this._storage()?.setItem(Rn, JSON.stringify(t));
		} catch {}
	}
	_read() {
		try {
			let e = JSON.parse(this._storage()?.getItem(Rn) ?? "{}");
			return e && typeof e == "object" ? e : {};
		} catch {
			return {};
		}
	}
}(), Bn = (e, t, n, r, i, a) => e === "MSE" ? new jn(t, n, r, a) : new kn(t, n, r, i, a), Vn = class {
	_hass;
	_video;
	ref;
	options;
	_onState;
	_factory;
	_cuts;
	_webRtc;
	state = { kind: "idle" };
	events = [];
	onCount = () => void 0;
	_session;
	_timer;
	_failures = 0;
	_switchNoted = !1;
	_blockedNoted = !1;
	_run = 0;
	constructor(e, t, n, r, i = () => void 0, a = Bn, o = In, s = zn) {
		this._hass = e, this._video = t, this.ref = n, this.options = r, this._onState = i, this._factory = a, this._cuts = o, this._webRtc = s;
	}
	get running() {
		return this.state.kind !== "idle";
	}
	start() {
		this.running || (this._failures = 0, this._attempt(this._run));
	}
	retryNow() {
		this.state.kind === "waiting" && (clearTimeout(this._timer), this._attempt(this._run));
	}
	stop() {
		this._run += 1, clearTimeout(this._timer), this._session?.close(), this._session = void 0, this.state.kind !== "idle" && this._note("stopped"), this._set({ kind: "idle" });
	}
	async _attempt(e) {
		let t = this._webRtc.preferMse(), n = t || this.options.warm && !this._cuts.preferWebRtc(), r = this.options.warm && !n;
		r && !this._switchNoted && this._note("WebRTC first: this network cuts MSE's connections"), this._switchNoted = r;
		let i = t && !this.options.warm;
		i && !this._blockedNoted && this._note("MSE first: WebRTC does not connect from here"), this._blockedNoted = i;
		let a = n ? ["MSE", "WebRTC"] : ["WebRTC", "MSE"], o = "failed", s = !1;
		for (let t of a) {
			this._note(`${t}: starting`), this._set({
				kind: "starting",
				transport: t
			});
			let n = this._factory(t, this._hass, this._video, this.ref, this.options.iceServers, Mn[t]);
			this._session = n;
			let i = Date.now();
			n.onEnd = (r, a) => {
				this._ended(e, n, i, r, t === "MSE" && a);
			};
			let a = await n.done;
			if (e !== this._run || this._session !== n) return;
			if (a.ok) {
				let e = a.firstFrameMs;
				this._note(`${t}: playing${e === void 0 ? "" : `, first frame in ${(e / 1e3).toFixed(2)} s`}`), this.onCount("plays"), t === "WebRTC" ? this._webRtc.works() : s && this._webRtc.note() && this._note(`WebRTC could not connect but MSE played: MSE goes first from here for ${Ln / 864e5} days`), this._set({
					kind: "playing",
					transport: t,
					result: a
				});
				return;
			}
			n.close(), this._session = void 0, o = `${t}: ${a.error ?? "failed"}`, this._note(o), this.onCount("failures"), t === "WebRTC" && "answer" in a.steps && !("connected" in a.steps) && (s = !0), r && t === "WebRTC" && this._cuts.preferWebRtc() && (this._cuts.giveUp(), this._note("WebRTC could not start either: MSE goes first again"));
		}
		this._failures += 1, this._wait(e, o);
	}
	_ended(e, t, n, r, i) {
		if (e !== this._run || this._session !== t) return;
		t.close(), this._session = void 0;
		let a = Date.now() - n;
		this._note(`ended after ${Math.round(a / 1e3)} s: ${r}`), this.onCount("drops"), i && a >= 6e4 && this._cuts.note() && this._note(`this page's MSE connections were cut twice within ${Pn / 6e4} min: WebRTC goes first for ${Fn / 6e4} min`), a >= 3e4 ? (this._failures = 0, this._attempt(e)) : (this._failures += 1, this._wait(e, r));
	}
	_wait(e, t) {
		let n = Nn[Math.min(this._failures, Nn.length) - 1] ?? Nn[0];
		this._note(`next try in ${n} s`), this._set({
			kind: "waiting",
			error: t,
			retryAt: Date.now() + n * 1e3
		}), this._timer = setTimeout(() => {
			e === this._run && this._attempt(e);
		}, n * 1e3);
	}
	_note(e) {
		this.events.push({
			at: Date.now(),
			text: e
		}), this.events.length > 20 && this.events.splice(0, this.events.length - 20);
	}
	_set(e) {
		this.state = e, this._onState(e);
	}
};
//#endregion
//#region src/network.ts
function Hn(e) {
	let t = e.toLowerCase();
	if (t.endsWith(".ui.nabu.casa")) return "Nabu Casa";
	if (t.endsWith(".ts.net")) return "Tailscale";
	let n = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(t);
	if (n) {
		let [e = 0, t = 0] = n.slice(1, 3).map(Number);
		return e === 100 && t >= 64 && t < 128 ? "Tailscale" : e === 10 || e === 127 || e === 192 && t === 168 || e === 172 && t >= 16 && t < 32 ? "local" : "remote";
	}
	return t === "localhost" || t.endsWith(".local") || t.endsWith(".lan") || !t.includes(".") ? "local" : "own domain";
}
var Un = () => navigator.connection;
function Wn(e = location.hostname, t = Un()) {
	if (t?.saveData) return {
		where: "away",
		why: "with data saver on"
	};
	if (t?.type === "cellular") return {
		where: "away",
		why: "on mobile data"
	};
	if (t?.effectiveType && /2g|3g/.test(t.effectiveType)) return {
		where: "away",
		why: "on a slow connection"
	};
	switch (Hn(e)) {
		case "Nabu Casa": return {
			where: "away",
			why: "through Nabu Casa"
		};
		case "Tailscale": return {
			where: "away",
			why: "through Tailscale"
		};
		case "remote": return {
			where: "away",
			why: "away from home"
		};
		default: return {
			where: "home",
			why: "at home"
		};
	}
}
var Gn = "reolink-viewer.full-screen-hd";
function Kn() {
	try {
		let e = JSON.parse(localStorage.getItem(Gn) ?? "{}");
		return e && typeof e == "object" ? e : {};
	} catch {
		return {};
	}
}
function qn(e) {
	let t = Kn()[e.where];
	return typeof t == "boolean" ? {
		hd: t,
		chosen: !0
	} : {
		hd: e.where === "home",
		chosen: !1
	};
}
function Jn(e, t) {
	try {
		localStorage.setItem(Gn, JSON.stringify({
			...Kn(),
			[e]: t
		}));
	} catch {}
}
var Yn = "reolink-viewer.full-screen-keep-taps";
function Xn() {
	try {
		return localStorage.getItem(Yn) !== "off";
	} catch {
		return !0;
	}
}
function Zn(e) {
	try {
		localStorage.setItem(Yn, e ? "on" : "off");
	} catch {}
}
//#endregion
//#region src/playback/time.ts
var Qn = /* @__PURE__ */ new Map();
function B(e, t) {
	let n = `${e ?? ""}|${JSON.stringify(t)}`, r = Qn.get(n);
	if (!r) {
		try {
			r = new Intl.DateTimeFormat(void 0, {
				...t,
				...e ? { timeZone: e } : {}
			});
		} catch {
			r = new Intl.DateTimeFormat(void 0, t);
		}
		Qn.set(n, r);
	}
	return r;
}
function $n(e, t) {
	return B(t, {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).format(e);
}
function V(e, t, n = !1) {
	return B(t, {
		hour: "2-digit",
		minute: "2-digit",
		...n ? { second: "2-digit" } : {},
		hourCycle: "h23"
	}).format(e);
}
function er(e, t) {
	let n = B(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(e), r = (e) => n.find((t) => t.type === e)?.value ?? "";
	return `${r("year")}-${r("month")}-${r("day")}`;
}
function tr(e, t) {
	let n = B(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23"
	}).formatToParts(e), r = (e) => Number(n.find((t) => t.type === e)?.value ?? 0);
	return Date.UTC(r("year"), r("month") - 1, r("day"), r("hour"), r("minute"), r("second")) - Math.floor(e / 1e3) * 1e3;
}
function nr(e) {
	try {
		let t = new Intl.Locale(e ?? navigator.language), n = t.getWeekInfo?.() ?? t.weekInfo;
		if (n) return n.firstDay % 7;
	} catch {}
	return +!/^en-(US|CA)|^ja|^he/.test(e ?? navigator.language);
}
//#endregion
//#region src/pip.ts
var H = "picture-in-picture";
function rr() {
	return document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture == "function";
}
function ir(e = document.createElement("video")) {
	if (rr()) return !0;
	let t = e;
	return typeof t.webkitSupportsPresentationMode == "function" && t.webkitSupportsPresentationMode(H);
}
function U(e) {
	return e ? document.pictureInPictureElement === e || e.webkitPresentationMode === H : !1;
}
async function ar(e) {
	if (rr()) {
		await e.requestPictureInPicture();
		return;
	}
	let t = e;
	if (typeof t.webkitSetPresentationMode != "function") throw Error("this browser has no picture-in-picture");
	t.webkitSetPresentationMode(H);
}
async function W(e) {
	if (!e) return;
	if (document.pictureInPictureElement === e) {
		await document.exitPictureInPicture();
		return;
	}
	let t = e;
	t.webkitPresentationMode === H && t.webkitSetPresentationMode?.("inline");
}
async function or(e, t) {
	if (!U(e)) return !1;
	try {
		return await ar(t), !0;
	} catch {
		return await W(e).catch(() => void 0), !1;
	}
}
//#endregion
//#region src/components/live-controls.ts
var sr = 5e3, cr = [
	"left_up",
	"up",
	"right_up",
	"left",
	null,
	"right",
	"left_down",
	"down",
	"right_down"
], lr = {
	left: 0,
	left_up: 45,
	up: 90,
	right_up: 135,
	right: 180,
	right_down: 225,
	down: 270,
	left_down: 315
}, ur = {
	left: "Move left",
	right: "Move right",
	up: "Move up",
	down: "Move down",
	left_up: "Move left and up",
	left_down: "Move left and down",
	right_up: "Move right and up",
	right_down: "Move right and down",
	zoom_in: "Zoom in",
	zoom_out: "Zoom out"
}, dr = class extends A {
	static properties = {
		hass: { attribute: !1 },
		controls: { attribute: !1 },
		cameraName: { attribute: !1 },
		_moving: { state: !0 },
		_confirmSiren: { state: !0 },
		_error: { state: !0 }
	};
	_movement;
	_errorTimer;
	constructor() {
		super(), this.cameraName = "Camera", this._confirmSiren = !1;
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.release(), clearTimeout(this._errorTimer);
	}
	press(e) {
		let t = this.controls?.ptz?.[e];
		!this._moving && t && this._usable(t) && (this._moving = e, this._movement = this._call("button", "press", t, ur[e].toLowerCase()));
	}
	release() {
		if (!this._moving) return;
		this._moving = void 0;
		let e = this.controls?.ptz?.stop, t = this._movement ?? Promise.resolve();
		this._movement = void 0, e && t.finally(() => this._call("button", "press", e, "stop moving"));
	}
	_state(e) {
		return e ? this.hass?.states[e] : void 0;
	}
	_usable(e) {
		let t = this._state(e)?.state;
		return t !== void 0 && t !== "unavailable";
	}
	async _call(e, t, n, r, i = {}) {
		try {
			await this.hass?.callService(e, t, i, { entity_id: n }, !1);
		} catch (e) {
			this._showError(`Could not ${r}: ${j(e).message}`);
		}
	}
	_showError(e) {
		this._error = e, clearTimeout(this._errorTimer), this._errorTimer = setTimeout(() => {
			this._error = void 0;
		}, sr);
	}
	_step(e, t, n) {
		let r = this._state(e), i = Number(r?.state);
		if (!r || !Number.isFinite(i)) return;
		let a = r.attributes, o = a.min ?? 0, s = a.max ?? 100, c = Math.max(a.step ?? 1, Math.round((s - o) / 10)), l = Math.min(s, Math.max(o, i + t * c));
		l !== i && this._call("number", "set_value", e, n, { value: l });
	}
	render() {
		let e = this.controls ?? {};
		return C`${this._renderTop(e)} ${this._renderPad(e)} ${this._renderZoom(e)}
    ${this._confirmSiren ? this._renderConfirm() : E}
    ${this._error ? C`<div class="error" role="alert">${this._error}</div>` : E}`;
	}
	_renderTop(e) {
		let { preset: t, floodlight: n, siren: r } = e;
		if (!t && !n && !r) return E;
		let i = this._state(t)?.attributes?.options ?? [], a = this._state(n)?.state === "on", o = this._state(r)?.state === "on";
		return C`<div class="top">
      ${t && i.length ? C`<select
            aria-label="Go to a preset"
            ?disabled=${!this._usable(t)}
            @change=${(e) => {
			let n = e.target, r = n.value;
			n.value = "", r && this._call("select", "select_option", t, "go to the preset", { option: r });
		}}
          >
            <option value="">Preset…</option>
            ${i.map((e) => C`<option value=${e}>${e}</option>`)}
          </select>` : E}
      ${n ? C`<button
            class="toggle ${a ? "on" : ""}"
            aria-pressed=${a ? "true" : "false"}
            ?disabled=${!this._usable(n)}
            @click=${() => {
			this._call("light", a ? "turn_off" : "turn_on", n, "switch the floodlight");
		}}
          >
            Light
          </button>` : E}
      ${r ? C`<button
            class="toggle siren ${o ? "on" : ""}"
            aria-pressed=${o ? "true" : "false"}
            ?disabled=${!this._usable(r)}
            @click=${() => {
			o ? this._call("siren", "turn_off", r, "stop the siren") : this._confirmSiren = !0;
		}}
          >
            ${o ? "Stop siren" : "Siren"}
          </button>` : E}
    </div>`;
	}
	updated(e) {
		if (!e.has("_confirmSiren")) return;
		let t = this._confirmSiren ? ".confirm button" : "button.siren";
		(this._confirmSiren || e.get("_confirmSiren") === !0) && this.renderRoot.querySelector(t)?.focus();
	}
	_renderConfirm() {
		let e = this.controls?.siren;
		return C`<div
      class="confirm"
      role="alertdialog"
      aria-labelledby="siren-title"
      @keydown=${(e) => {
			e.key === "Escape" && (e.stopPropagation(), this._confirmSiren = !1);
		}}
    >
      <strong id="siren-title">Sound the siren on ${this.cameraName}?</strong>
      <span class="small">It is loud, and keeps sounding until you stop it.</span>
      <span class="actions">
        <button
          @click=${() => {
			this._confirmSiren = !1;
		}}
        >
          Cancel
        </button>
        <button
          class="danger"
          @click=${() => {
			this._confirmSiren = !1, e && this._call("siren", "turn_on", e, "sound the siren");
		}}
        >
          Sound it
        </button>
      </span>
    </div>`;
	}
	_renderPad(e) {
		let t = e.ptz;
		return t?.stop ? C`<div class="pad" role="group" aria-label="Move the camera">
      ${cr.map((e) => e && t[e] ? this._holdButton(e, C`<svg viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(${lr[e] ?? 0}deg)">
              ${w`<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`}
            </svg>`) : C`<span></span>`)}
    </div>` : E;
	}
	_renderZoom(e) {
		let t = e.ptz, n = t?.stop && t.zoom_in && t.zoom_out, r = n ? void 0 : e.zoom, i = e.focus;
		if (!n && !r && !i) return E;
		let a = (e, t, n) => C`<span class="stepper" role="group" aria-label=${n}>
        <button
          aria-label=${`${n} out`}
          ?disabled=${!this._usable(e)}
          @click=${() => {
			this._step(e, -1, t);
		}}
        >
          ${N("minus")}
        </button>
        <span class="small">${n}</span>
        <button
          aria-label=${`${n} in`}
          ?disabled=${!this._usable(e)}
          @click=${() => {
			this._step(e, 1, t);
		}}
        >
          ${N("plus")}
        </button>
      </span>`;
		return C`<div class="zoom">
      ${i ? a(i, "focus", "Focus") : E}
      ${n ? C`<span class="stepper" role="group" aria-label="Zoom">
            ${this._holdButton("zoom_out", N("minus"))}<span class="small">Zoom</span>${this._holdButton("zoom_in", N("plus"))}
          </span>` : r ? a(r, "zoom", "Zoom") : E}
    </div>`;
	}
	_holdButton(e, t) {
		let n = this.controls?.ptz?.[e];
		return C`<button
      class="hold ${this._moving === e ? "held" : ""}"
      aria-label=${ur[e]}
      ?disabled=${!this._usable(n)}
      @pointerdown=${(t) => {
			t.preventDefault();
			try {
				t.currentTarget.setPointerCapture(t.pointerId);
			} catch {}
			this.press(e);
		}}
      @pointerup=${() => {
			this.release();
		}}
      @pointercancel=${() => {
			this.release();
		}}
      @lostpointercapture=${() => {
			this.release();
		}}
      @keydown=${(t) => {
			(t.key === "Enter" || t.key === " ") && !t.repeat && (t.preventDefault(), this.press(e));
		}}
      @keyup=${(e) => {
			(e.key === "Enter" || e.key === " ") && this.release();
		}}
      @blur=${() => {
			this.release();
		}}
      @contextmenu=${(e) => {
			e.preventDefault();
		}}
    >
      ${t}
    </button>`;
	}
	static styles = [L, o`
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        color: var(--rv-on-board);
      }
      .top,
      .pad,
      .zoom,
      .confirm,
      .error {
        position: absolute;
        pointer-events: auto;
      }
      /* Square controls in the board's ink over the video. */
      button,
      select {
        border: none;
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.72);
        color: var(--rv-on-board);
        min-height: 32px;
      }
      button:disabled {
        opacity: 0.4;
      }
      .top {
        top: 8px;
        right: 36px;
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .top select {
        padding: 4px 8px;
        max-width: 140px;
      }
      .toggle {
        padding: 4px 12px;
      }
      .toggle.on {
        background: var(--rv-on-board);
        color: var(--rv-board);
      }
      .toggle.siren.on {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .pad {
        left: 8px;
        bottom: 28px;
        display: grid;
        grid-template-columns: repeat(3, 32px);
        grid-template-rows: repeat(3, 32px);
        gap: 2px;
      }
      .hold {
        width: 32px;
        height: 32px;
        padding: 4px;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }
      .hold.held {
        background: var(--rv-on-board);
        color: var(--rv-board);
      }
      .hold svg {
        display: block;
        width: 24px;
        height: 24px;
      }
      .zoom {
        right: 48px;
        bottom: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: flex-end;
      }
      .stepper {
        display: flex;
        gap: 4px;
        align-items: center;
        text-shadow: 0 0 3px #000;
      }
      .stepper button {
        width: 32px;
        padding: 0;
        font-size: 18px;
      }
      .confirm {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: min(320px, 90%);
        padding: 12px 16px;
        border-top: 2px solid var(--rv-fault);
        background: var(--rv-board);
      }
      .confirm .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .confirm button {
        padding: 4px 12px;
      }
      .confirm button.danger {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .error {
        left: 50%;
        top: 44px;
        transform: translateX(-50%);
        max-width: 90%;
        padding: 6px 12px;
        font-size: 13px;
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
    `];
};
customElements.get("rv-live-controls") || customElements.define("rv-live-controls", dr);
//#endregion
//#region src/clipboard.ts
async function fr(e) {
	let t = navigator.clipboard;
	try {
		if (window.isSecureContext && t) return await t.writeText(e), !0;
	} catch {}
	let n = document.createElement("textarea");
	n.value = e, n.setAttribute("readonly", ""), n.style.cssText = `position:absolute;left:-9999px;top:${window.scrollY}px;font-size:12pt;border:0;padding:0;margin:0`, document.body.append(n), n.select(), n.setSelectionRange(0, e.length);
	try {
		return document.execCommand("copy");
	} catch {
		return !1;
	} finally {
		n.remove();
	}
}
//#endregion
//#region src/live/debug.ts
var G = (e) => `${(e / 1e3).toFixed(e < 1e4 ? 2 : 0)} s`;
function pr(e, t, n = Date.now()) {
	let r = e.connection, i = [`${e.camera}${r ? ` · ${r.via === "nvr" ? "through the NVR" : "direct"} (${r.entry_title})${r.is_battery ? " · on battery" : ""}` : ""}`];
	for (let r of e.players) {
		if (i.push(`${r.label} (${r.stream}, ${r.warm ? "kept warm" : "cold"}): ${mr(r.state, n)}`), r.state.kind === "playing") {
			let e = r.state.result.pair;
			e?.local && i.push(`  path: ${e.local} ↔ ${e.remote ?? "?"}${e.rttMs === void 0 ? "" : `, rtt ${e.rttMs} ms`}`);
		}
		i.push(`  server: ${hr(t[r.label])}`);
	}
	e.hd && i.push(`HD choice: ${e.hd}`), e.webRtcFirstUntil !== void 0 && e.webRtcFirstUntil > n && i.push(`Network: it cut MSE's connections twice, so WebRTC goes first until ${gr(e.webRtcFirstUntil)}`), e.mseFirstUntil !== void 0 && e.mseFirstUntil > n && i.push(`Network: WebRTC does not connect from here, so MSE goes first until ${_r(e.mseFirstUntil)}`);
	for (let t of e.players) if (t.events.length) {
		i.push(`Events (${t.label}):`);
		for (let e of t.events) i.push(`  ${gr(e.at)} ${e.text}`);
	}
	return i.join("\n");
}
function mr(e, t) {
	switch (e.kind) {
		case "idle": return "stopped";
		case "starting": return `starting over ${e.transport}`;
		case "waiting": return `${e.error}; next try in ${G(Math.max(0, e.retryAt - t))}`;
		case "playing": {
			let t = e.result, n = t.width ?? t.pair?.width, r = t.height ?? t.pair?.height, i = t.pair?.codec ?? /codecs="?([^"]+)/.exec(t.mse?.mime ?? "")?.[1];
			return [
				`playing over ${e.transport}`,
				t.firstFrameMs === void 0 ? void 0 : `first frame in ${G(t.firstFrameMs)}`,
				n && r ? `${n}×${r}` : void 0,
				i
			].filter((e) => e !== void 0).join(" · ");
		}
	}
}
function hr(e) {
	if (e === void 0) return "…";
	if (typeof e == "string") return `cannot read: ${e}`;
	let t = [e.state ? `go2rtc ${e.state.active ? "streaming" : "idle"}, ${e.state.consumers} consumer${e.state.consumers === 1 ? "" : "s"}` : "not in go2rtc", `held ${e.holds}×`], n = e.cache;
	return n ? (t.push(`${n.warm ? "warm feed" : "feed"} ${G(n.age_ms)} old, ${n.viewers} viewer${n.viewers === 1 ? "" : "s"}`), n.key_frame_age_ms !== null && t.push(`key frame ${G(n.key_frame_age_ms)} ago${n.key_interval_ms === null ? "" : `, every ${G(n.key_interval_ms)}`}`), n.parameter_sets && t.push(`parameter sets ${n.parameter_sets}`), n.ends && t.push(`${n.ends} feed${n.ends === 1 ? "" : "s"} dropped (last: ${n.last_end ?? "?"})`)) : t.push("no MSE feed"), t.join(", ");
}
function gr(e) {
	return new Date(e).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	});
}
function _r(e) {
	return new Date(e).toLocaleString([], {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
//#endregion
//#region src/components/live-debug.ts
var vr = 2e3, yr = "rv-live-debug-close", br = class extends A {
	static properties = {
		hass: { attribute: !1 },
		info: { attribute: !1 },
		_states: { state: !0 },
		_copied: { state: !0 }
	};
	_timer;
	constructor() {
		super(), this._states = {};
	}
	connectedCallback() {
		super.connectedCallback(), this._poll(), this._timer = setInterval(() => {
			this._poll();
		}, vr);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._timer);
	}
	async _poll() {
		let e = this.hass, t = this.info, n = t?.connection;
		if (!e || !t || !n) return;
		let r = async (t) => {
			try {
				return await ct(e, {
					connectionId: n.connection_id,
					stream: t
				});
			} catch (e) {
				return j(e).message;
			}
		}, i = await Promise.all(t.players.map(async (e) => [e.label, await r(e.stream)]));
		this._states = Object.fromEntries(i);
	}
	firstUpdated() {
		this.renderRoot.querySelector(".panel")?.focus();
	}
	_close() {
		this.dispatchEvent(new CustomEvent(yr, {
			bubbles: !0,
			composed: !0
		}));
	}
	render() {
		let e = this.info, t = e ? pr(e, this._states) : "";
		return C`<div
      class="panel"
      role="dialog"
      tabindex="-1"
      aria-label=${`${e?.camera ?? "Camera"}: debug`}
      @keydown=${(e) => {
			e.key === "Escape" && (e.stopPropagation(), this._close());
		}}
    >
      <pre tabindex="0" aria-label="Debug text">${t}</pre>
      <div class="actions">
        <button
          @click=${() => {
			fr(t).then((e) => {
				this._copied = e;
			});
		}}
        >
          ${this._copied === void 0 ? "Copy" : this._copied ? "Copied" : "Could not copy"}
        </button>
        <button
          @click=${() => {
			this._close();
		}}
        >
          Close
        </button>
      </div>
    </div>`;
	}
	static styles = [L, o`
      :host {
        position: absolute;
        inset: 0;
        color: #fff;
      }
      .panel {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.85);
        border-radius: inherit;
      }
      pre {
        flex: 1;
        margin: 0;
        padding: 8px;
        overflow: auto;
        font-size: 11px;
        line-height: 1.4;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        padding: 6px 8px;
      }
      .actions button {
        padding: 4px 12px;
      }
    `];
};
customElements.get("rv-live-debug") || customElements.define("rv-live-debug", br);
//#endregion
//#region src/components/live-tile.ts
var xr = 3e3, Sr = "rv-live-open", Cr = "rv-live-full", wr = "rv-live-count", Tr = "rv-live-state", Er = class extends A {
	static properties = {
		hass: { attribute: !1 },
		camera: { attribute: !1 },
		connection: { attribute: !1 },
		stream: { attribute: !1 },
		image: { attribute: !1 },
		iceServers: { attribute: !1 },
		warm: { attribute: !1 },
		openable: { type: Boolean },
		fill: {
			type: Boolean,
			reflect: !0
		},
		fit: { reflect: !0 },
		number: { attribute: !1 },
		suspended: { attribute: !1 },
		controls: { attribute: !1 },
		_state: { state: !0 },
		_onScreen: { state: !0 },
		_pageVisible: { state: !0 },
		_wanted: { state: !0 },
		_full: { state: !0 },
		_hd: { state: !0 },
		_hdState: { state: !0 },
		_debug: { state: !0 },
		_pip: { state: !0 },
		_hdWanted: { state: !0 }
	};
	_link = {
		where: "home",
		why: "at home",
		chosen: !1
	};
	_player;
	_hdPlayer;
	_hdChoosing;
	_native = !1;
	_observer;
	_offscreenTimer;
	constructor() {
		super(), this.stream = "sub", this.openable = !1, this.fill = !1, this.fit = "cover", this.suspended = !1, this._state = { kind: "idle" }, this._hdState = { kind: "idle" }, this._onScreen = typeof IntersectionObserver > "u", this._pageVisible = document.visibilityState !== "hidden", this._wanted = !0, this._full = !1, this._debug = !1, this._hdWanted = !0;
	}
	connectedCallback() {
		super.connectedCallback(), document.addEventListener("visibilitychange", this._onVisibility), document.addEventListener("fullscreenchange", this._onFullscreenChange), document.addEventListener("keydown", this._onKeydown), typeof IntersectionObserver < "u" && (this._observer = new IntersectionObserver((e) => {
			this._onScreen = e.some((e) => e.isIntersecting);
		}, { rootMargin: "100px" }), this._observer.observe(this)), this.requestUpdate();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), document.removeEventListener("fullscreenchange", this._onFullscreenChange), document.removeEventListener("keydown", this._onKeydown), this._observer?.disconnect(), this._observer = void 0, clearTimeout(this._offscreenTimer), W(this._pipVideo).catch(() => void 0), this._pip = void 0, this._player?.stop(), this._hdPlayer?.stop(), this.exitFull();
	}
	_video(e) {
		return this.renderRoot.querySelector(`video.${e}`);
	}
	get _pipVideo() {
		return this._pip ? this._video(this._pip) : null;
	}
	_onPipChange = () => {
		this._pip = U(this._video("sub")) ? "sub" : U(this._video("hd")) ? "hd" : void 0;
	};
	async _togglePip() {
		try {
			if (this._pip) await W(this._pipVideo);
			else {
				let e = this._video(this.hdShown ? "hd" : "sub");
				e && await ar(e);
			}
		} catch {}
	}
	_onVisibility = () => {
		this._pageVisible = document.visibilityState !== "hidden";
	};
	_count = (e) => {
		this.dispatchEvent(new CustomEvent(wr, {
			detail: {
				camera: this.camera?.name ?? "Camera",
				kind: e
			},
			bubbles: !0
		}));
	};
	_onFullscreenChange = () => {
		this._native && !document.fullscreenElement && (this._native = !1, this.exitFull());
	};
	_onKeydown = (e) => {
		e.key === "Escape" && this._full && !this._native && this.exitFull();
	};
	get shouldPlay() {
		return this.isConnected && this._wanted && !this.suspended && this._pageVisible && this._onScreen && this.offlineSince === void 0 && this.connection?.streams[this.stream] !== void 0;
	}
	get offlineSince() {
		return Lt(this.hass, this.connection);
	}
	get waitsForTap() {
		return this.connection?.is_battery === !0 || this.camera?.records === !1;
	}
	get hdShown() {
		return this._full && this._hdState.kind === "playing";
	}
	get full() {
		return this._full;
	}
	enterFull() {
		if (this._full) return;
		let e = Wn(), t = qn(e);
		this._link = {
			...e,
			chosen: t.chosen
		}, this._hdWanted = t.hd, this._full = !0, this._wanted = !0, document.fullscreenEnabled && typeof this.requestFullscreen == "function" && this.requestFullscreen().then(() => {
			this._native = !0, this._full || document.exitFullscreen().catch(() => void 0);
		}).catch(() => void 0), this._fullChanged();
	}
	exitFull() {
		this._full && (this._full = !1, this._native && document.fullscreenElement && document.exitFullscreen().catch(() => void 0), this._native = !1, this._fullChanged());
	}
	_fullChanged() {
		this.dispatchEvent(new CustomEvent(Cr, {
			detail: {
				cameraId: this.camera?.id,
				full: this._full
			},
			bubbles: !0,
			composed: !0
		}));
	}
	willUpdate(e) {
		(e.has("connection") || e.has("stream")) && (this._player?.stop(), this._player = void 0, this._hdPlayer?.stop(), this._hdPlayer = void 0, this._hd = void 0, this._hdChoosing = void 0, this._wanted = this._full || !this.waitsForTap), this.toggleAttribute("full", this._full);
	}
	updated() {
		this._driveSub(), this._driveHd();
	}
	_driveSub() {
		let e = this._ensurePlayer();
		e && (e.options.warm = this.warm ?? this.connection?.streams[this.stream]?.warm === !0, this.shouldPlay && !this.hdShown || this._pip === "sub" ? (clearTimeout(this._offscreenTimer), this._offscreenTimer = void 0, this._start(e)) : e.running && (!this._pageVisible || !this._wanted || this.suspended || this.hdShown ? e.stop() : this._offscreenTimer ??= setTimeout(() => {
			this._offscreenTimer = void 0, this.shouldPlay || (this._pip !== "sub" && this._player?.stop(), this._pip !== "hd" && this._hdPlayer?.stop());
		}, xr)));
	}
	_toggleHd() {
		this._hdWanted = !this._hdWanted, this._link = {
			...this._link,
			chosen: !0
		}, Xn() && Jn(this._link.where, this._hdWanted);
	}
	_driveHd() {
		let e = this.connection, t = this._full && this.shouldPlay, n = t && this._hdWanted || this._pip === "hd";
		t && e && !this._hd && this._hdChoosing !== e && (this._hdChoosing = e, un(e).then((t) => {
			this.connection === e && (this._hd = t);
		}));
		let r = this._ensureHdPlayer();
		r && (n ? this._start(r) : r.running && (!this._full || !this._pageVisible || this.suspended || !this._wanted || !this._hdWanted) && r.stop());
	}
	_start(e) {
		!e.running && (e.options.warm || this.iceServers) && (e.options.iceServers = this.iceServers ?? [], e.start());
	}
	_ensurePlayer() {
		if (this._player) return this._player;
		let e = this.renderRoot.querySelector("video.sub"), t = this.connection;
		if (this.hass && e && t) return this._player = new Vn(this.hass, e, {
			connectionId: t.connection_id,
			stream: this.stream
		}, {
			warm: !1,
			iceServers: []
		}, (e) => {
			let t = e.kind === "playing";
			t !== (this._state.kind === "playing") && this.dispatchEvent(new CustomEvent(Tr, {
				detail: {
					cameraId: this.camera?.id ?? "",
					live: t
				},
				bubbles: !0
			})), this._state = e;
		}), this._player.onCount = this._count, this._player;
	}
	_ensureHdPlayer() {
		if (this._hdPlayer) return this._hdPlayer;
		let e = this._hd?.stream, t = this.renderRoot.querySelector("video.hd"), n = this.connection;
		if (this.hass && e && t && n) return this._hdPlayer = new Vn(this.hass, t, {
			connectionId: n.connection_id,
			stream: e
		}, {
			warm: n.streams[e]?.warm === !0,
			iceServers: []
		}, (e) => {
			this._hdState = e;
		}), this._hdPlayer.onCount = this._count, this._hdPlayer;
	}
	_activate() {
		this._full || (this._wanted ? this.openable && this.camera && this.dispatchEvent(new CustomEvent(Sr, {
			detail: { cameraId: this.camera.id },
			bubbles: !0,
			composed: !0
		})) : this._wanted = !0);
	}
	render() {
		let e = this._state, t = e.kind === "playing", n = this.camera?.name ?? "Camera", r = !this._full && (this.openable || !this._wanted);
		return C`<div class="frame">
      <div
        class="tile ${t ? "playing" : ""} ${this.hdShown ? "hd-on" : ""} ${r ? "interactive" : ""}"
        @click=${() => {
			this._activate();
		}}
      >
        ${this.image ? C`<img class="poster" src=${this.image.url} alt="" />` : E}
        <video
          class="sub"
          muted
          playsinline
          aria-label=${`${n} live`}
          @enterpictureinpicture=${this._onPipChange}
          @leavepictureinpicture=${this._onPipChange}
          @webkitpresentationmodechanged=${this._onPipChange}
        ></video>
        ${this._hd?.stream ? C`<video
              class="hd"
              muted
              playsinline
              aria-label=${`${n} live in HD`}
              @enterpictureinpicture=${this._onPipChange}
              @leavepictureinpicture=${this._onPipChange}
              @webkitpresentationmodechanged=${this._onPipChange}
            ></video>` : E}
        ${r ? C`<button
              class="open"
              aria-label=${this._wanted ? `Open ${n}` : `Watch ${n}`}
              aria-describedby="state status"
            ></button>` : E}
        ${this.number !== void 0 && !this._full ? C`<span class="num" aria-hidden="true">${this.number}</span>` : E}
        <div class="label">
          <span class="name">${n}</span>
          ${this._wanted ? E : C`<span class="hint">
                ${this.connection?.is_battery ? "Tap to wake it and watch" : "Tap to watch live"}
              </span>`}
        </div>
        ${this.hdShown ? E : this._renderStatus(e)}
        ${this._renderHd()}
      </div>
      ${this._debug ? C`<rv-live-debug
            .hass=${this.hass}
            .info=${this._debugInfo(n)}
            @rv-live-debug-close=${() => {
			this._debug = !1, this.updateComplete.then(() => {
				this.renderRoot.querySelector(".corner-button.info")?.focus();
			});
		}}
          ></rv-live-debug>` : E}
      <button
        class="corner-button info"
        aria-label=${`${n} debug info`}
        aria-pressed=${this._debug ? "true" : "false"}
        title="What this tile plays, and how"
        @click=${() => {
			this._debug = !this._debug;
		}}
      >
        ${N("info")}
      </button>
      ${this.controls && (this._full || !this.openable) ? C`<rv-live-controls
            .hass=${this.hass}
            .controls=${this.controls}
            .cameraName=${n}
          ></rv-live-controls>` : E}
      ${(this._full || !this.openable) && (t || this.hdShown || this._pip) && ir() ? C`<button
            class="corner-button pip"
            aria-label=${this._pip ? "Leave picture in picture" : `${n} in picture in picture`}
            aria-pressed=${this._pip ? "true" : "false"}
            title=${this._pip ? "Leave picture in picture" : "Picture in picture: keep watching in a small window"}
            @click=${() => void this._togglePip()}
          >
            ${N("pip")}
          </button>` : E}
      <button
        class="corner-button full"
        aria-label=${this._full ? "Exit full screen" : `${n} full screen`}
        title=${this._full ? "Exit full screen" : "Full screen (HD)"}
        @click=${() => {
			this._full ? this.exitFull() : this.enterFull();
		}}
      >
        ${N(this._full ? "exitFull" : "enterFull")}
      </button>
    </div>`;
	}
	_debugInfo(e) {
		let t = [], n = (e, n, r, i) => {
			r && t.push({
				label: e,
				stream: n,
				warm: r.options.warm,
				state: i,
				events: [...r.events]
			});
		};
		return n("SD", this.stream, this._player, this._state), this._hd?.stream && n("HD", this._hd.stream, this._hdPlayer, this._hdState), {
			camera: e,
			connection: this.connection,
			players: t,
			hd: this._hd?.reason,
			webRtcFirstUntil: In.preferWebRtc() ? In.until : void 0,
			mseFirstUntil: zn.preferMse() ? zn.until : void 0
		};
	}
	_renderHd() {
		if (!this._full) return E;
		let e = this._hd;
		if (!e?.stream) return C`<div class="hd-status" title=${e?.reason ?? E}>
        <span class="badge">SD</span>
        <span class="small">${e ? e.reason : "Choosing the HD stream…"}</span>
      </div>`;
		let t = this._hdState, n;
		return n = this._hdWanted ? this.hdShown ? void 0 : t.kind === "waiting" ? `HD cannot play: ${rn(t.error).text}` : "HD starting…" : this._link.chosen ? "SD, as chosen on this device. Tap HD for full quality." : `Lighter SD ${this._link.why}. Tap HD for full quality.`, C`<div class="hd-status" title=${e.reason}>
      <button
        class="hd-toggle"
        aria-pressed=${this._hdWanted ? "true" : "false"}
        aria-label=${this._hdWanted ? "HD on: switch to the lighter SD" : "HD off: switch to HD"}
        @click=${(e) => {
			e.stopPropagation(), this._toggleHd();
		}}
      >
        HD
      </button>
      ${n ? C`<span class="small">${n}</span>` : E}
    </div>`;
	}
	_renderStatus(e) {
		let t = this.offlineSince;
		if (t !== void 0) {
			let e = this.hass?.config?.time_zone, n = Date.now() - t < 432e5 ? V(t, e) : $n(t, e);
			return C`${K("Offline", C`<i class="dot fault"></i>`)}
        <div class="status center offline" id="status" role="status">
          <span class="what">Offline since ${n}</span>
          <span class="small">Home Assistant cannot reach this camera. It plays again when it is back.</span>
        </div>`;
		}
		if (!this._wanted) {
			if (this.connection?.is_battery) return K("Asleep");
			let e = this.image ? V(this.image.taken, this.hass?.config?.time_zone) : void 0;
			return K(e ? `Picture ${e}` : "No picture yet", N("picture"));
		}
		if (!this.connection?.streams[this.stream]) return K(`No ${this.stream} stream`);
		switch (e.kind) {
			case "playing": return K("Live", C`<i class="dot"></i>`);
			case "starting": return K("Starting");
			case "waiting": {
				let t = rn(e.error, this.connection.is_battery);
				return C`${K("Retrying")}
          <div class="status center" id="status" role="status">
            <span class="what">${t.text}</span>
            ${t.advice ? C`<span class="small">${t.advice}</span>` : E}
            <button
              aria-label=${`Retry now: ${this.camera?.name ?? "camera"}`}
              @click=${(e) => {
					e.stopPropagation(), this._player?.retryNow();
				}}
            >
              Retry now
            </button>
          </div>`;
			}
			default: return E;
		}
	}
	static styles = [L, o`
      :host {
        display: block;
        container-type: inline-size;
      }
      /* On the board: fill the cell. */
      :host([fill]),
      :host([fill]) .frame,
      :host([fill]) .tile {
        height: 100%;
      }
      :host([fill]) .tile {
        aspect-ratio: auto;
      }
      /* A board cell is as tall as the board makes it: what it says fits that. */
      :host([fill]:not([full])) .tile {
        container: board-tile / size;
      }
      /* On the board, never in full screen: there the whole picture shows, SD too. */
      :host([fill][fit="cover"]:not([full])) .poster,
      :host([fill][fit="cover"]:not([full])) video.sub {
        object-fit: cover;
      }
      /* Full screen: the browser's, or filling the window (the iPhone). The
         picture and its buttons stay clear of a phone's rounded corners, notch
         and home bar (its safe area); black fills the rest. */
      :host([full]) {
        position: fixed;
        inset: 0;
        z-index: 10000;
        box-sizing: border-box;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
          env(safe-area-inset-left, 0px);
        background: #000;
        overscroll-behavior: contain;
      }
      .frame {
        position: relative;
      }
      :host([full]) .frame,
      :host([full]) .tile {
        height: 100%;
      }
      :host([full]) .tile {
        aspect-ratio: auto;
      }
      :host([full]) .poster,
      :host([full]) video {
        object-fit: contain;
      }
      .tile {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 2px;
        overflow: hidden;
        color: #f4f4f1;
      }
      .tile.interactive {
        cursor: pointer;
      }
      /* Over the picture, under what the tile says: the tile as a button. */
      .open {
        position: absolute;
        inset: 0;
        width: 100%;
        min-height: 0;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 0;
        background: transparent;
        cursor: pointer;
      }
      .open:hover:not(:disabled) {
        background: transparent;
      }
      .open:focus-visible {
        outline: 2px solid #f4f4f1;
        outline-offset: -4px;
      }
      /* What the tile says lets a press through to it, but for its own buttons. */
      .num,
      .state,
      .status {
        pointer-events: none;
      }
      .status button {
        pointer-events: auto;
      }
      .poster,
      video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      video {
        opacity: 0;
        transition: opacity 0.3s;
      }
      .playing video.sub {
        opacity: 1;
      }
      /* HD replaces the sub stream at once, on its first frame. */
      video.hd {
        transition: none;
        background: #000;
      }
      .hd-on video.hd {
        opacity: 1;
      }
      .num {
        position: absolute;
        top: 8px;
        left: 8px;
        min-width: 26px;
        height: 26px;
        padding: 0 5px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: #f4f4f1;
        color: #111418;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .state {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        background: rgba(17, 20, 24, 0.74);
        font-size: 13px;
        font-weight: 500;
        line-height: 18px;
        white-space: nowrap;
      }
      /* A camera's own view has its controls top right, and no number. */
      :host(:not([fill])) .state {
        left: 8px;
        right: auto;
      }
      /* Full screen says SD or HD, top left. */
      :host([full]) .state {
        display: none;
      }
      .state .dot {
        width: 7px;
        height: 7px;
        background: currentColor;
      }
      /* Amber is a fault: a camera Home Assistant cannot reach. */
      .state .dot.fault {
        background: var(--rv-fault);
      }
      .state svg {
        width: 16px;
        height: 16px;
      }
      .label {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        padding: 26px 48px 8px 10px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0));
        pointer-events: none;
      }
      .name {
        font-size: 15px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hint {
        font-size: 13px;
        color: #c9cede;
      }
      .hd-status {
        position: absolute;
        top: 8px;
        left: 8px;
        display: flex;
        gap: 6px;
        align-items: center;
        max-width: calc(100% - 64px);
        text-shadow: 0 0 3px #000;
      }
      .hd-status .badge {
        color: #f4f4f1;
        border-color: rgba(244, 244, 241, 0.5);
      }
      .hd-toggle {
        min-height: 32px;
        padding: 0 10px;
        border: 1.5px solid rgba(244, 244, 241, 0.6);
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.6);
        color: #f4f4f1;
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
        text-shadow: none;
      }
      .hd-toggle:hover:not(:disabled) {
        background: rgba(17, 20, 24, 0.85);
      }
      .hd-toggle[aria-pressed="true"] {
        border-color: var(--rv-action);
        background: var(--rv-action);
        color: var(--rv-on-action);
      }
      .hd-toggle:focus-visible {
        outline-color: #f4f4f1;
      }
      .corner-button {
        position: absolute;
        right: 6px;
        bottom: 6px;
        width: 34px;
        height: 34px;
        min-height: 0;
        padding: 6px;
        border: none;
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.6);
        color: #f4f4f1;
      }
      .corner-button:hover:not(:disabled) {
        background: rgba(17, 20, 24, 0.85);
      }
      .corner-button:focus-visible {
        outline-color: #f4f4f1;
      }
      .corner-button.info {
        bottom: 44px;
        opacity: 0.85;
      }
      .corner-button.info[aria-pressed="true"] {
        background: var(--rv-action);
        color: var(--rv-on-action);
        opacity: 1;
      }
      .corner-button.pip {
        right: 44px;
      }
      .corner-button.pip[aria-pressed="true"] {
        background: var(--rv-action);
        color: var(--rv-on-action);
      }
      .corner-button svg {
        width: 22px;
        height: 22px;
      }
      /* On the board, its buttons show on hover; a touch screen has full screen only. */
      @media (hover: hover) {
        :host([fill]:not([full])) .corner-button {
          opacity: 0;
          transition: opacity 0.15s;
        }
        :host([fill]:not([full])) .frame:hover .corner-button,
        :host([fill]:not([full])) .corner-button:focus-visible,
        :host([fill]:not([full])) .corner-button[aria-pressed="true"] {
          opacity: 1;
        }
      }
      @media (hover: none) {
        :host([fill]:not([full])) .corner-button.info {
          display: none;
        }
      }
      .status.center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        /* Clear of the number and state above, and the name below. */
        padding: 36px 12px 34px;
        background: rgba(17, 20, 24, 0.55);
      }
      .status.center .what {
        max-width: 34ch;
        color: #f4f4f1;
        font-family: var(--rv-font-cond);
        font-size: 17px;
        font-weight: 600;
        line-height: 1.25;
      }
      .status.center .small {
        max-width: 42ch;
        color: rgba(244, 244, 241, 0.85);
      }
      .status.center.offline {
        background: rgba(17, 20, 24, 0.7);
      }
      /* The tile's number, state and name stay readable over a message. */
      .num,
      .state,
      .label {
        z-index: 1;
      }
      .status.center button {
        color: #f4f4f1;
        border-color: #f4f4f1;
      }
      .status.center button:hover:not(:disabled) {
        background: rgba(244, 244, 241, 0.12);
      }
      @container (max-width: 260px) {
        .num {
          top: 6px;
          left: 6px;
          min-width: 22px;
          height: 22px;
          font-size: 14px;
        }
        .state {
          top: 6px;
          right: 6px;
          padding: 2px 6px;
          font-size: 12px;
        }
        .label {
          padding: 20px 44px 6px 8px;
        }
        .name {
          font-size: 13px;
        }
        .hint {
          font-size: 12px;
        }
        .corner-button.info {
          display: none;
        }
        /* A small tile says what happened; what to do is on the camera's own view. */
        .status.center {
          padding: 30px 8px 26px;
          gap: 6px;
        }
        .status.center .what {
          font-size: 14px;
        }
        .status.center .small {
          display: none;
        }
      }
      /* A short board tile says what happened; what to do is on the camera's own view. */
      @container board-tile (max-height: 220px) {
        .status.center .small {
          display: none;
        }
      }
      /* Too short for a button as well: tapping it opens the camera's view, which has it. */
      @container board-tile (max-height: 130px) {
        .status.center button {
          display: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        video,
        .corner-button {
          transition: none;
        }
      }
    `];
};
function K(e, t) {
	return C`<span class="state" id="state">${t ?? E}${e}</span>`;
}
customElements.get("rv-live-tile") || customElements.define("rv-live-tile", Er);
//#endregion
//#region src/components/navigation.ts
var Dr = "rv-navigate", Or = "rv-toast";
function q(e, t) {
	e.dispatchEvent(new CustomEvent(Dr, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function kr(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(Or, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function Ar(e) {
	if (e.view === "live-check") return "#live-check";
	if (e.view === "soak") return "#soak";
	if (e.view === "list") return "#devices";
	if (e.view === "events") return e.date ? `#events/${e.date}` : "#events";
	if (e.view === "live") return "";
	let t = e.tab === "playback" && e.at !== void 0 ? `/${e.at}` : "";
	return `#device/${encodeURIComponent(e.id)}/${e.tab}${t}`;
}
function jr(e) {
	if (e === "#live-check") return { view: "live-check" };
	if (e === "#soak") return { view: "soak" };
	if (e === "#devices") return { view: "list" };
	if (e === "#events") return { view: "events" };
	let t = /^#events\/(\d{4}-\d{2}-\d{2})$/.exec(e);
	if (t?.[1]) return {
		view: "events",
		date: t[1]
	};
	let n = /^#device\/([^/]+)(?:\/(overview|live|settings|playback)(?:\/(\d+))?)?$/.exec(e);
	if (!n?.[1]) return { view: "live" };
	let r = n[2], i = decodeURIComponent(n[1]);
	return r === "playback" && n[3] ? {
		view: "device",
		id: i,
		tab: r,
		at: Number(n[3])
	} : {
		view: "device",
		id: i,
		tab: r === "live" || r === "settings" || r === "playback" ? r : "overview"
	};
}
//#endregion
//#region src/components/live-grid.ts
var Mr = 8, Nr = "rv-board", Pr = class extends A {
	static properties = {
		hass: { attribute: !1 },
		_full: { state: !0 },
		_boardFull: { state: !0 },
		_width: { state: !0 },
		_live: { state: !0 }
	};
	_data = new Ft(this);
	_resize;
	_announced;
	constructor() {
		super(), this._boardFull = !1, this._width = 0, this._live = /* @__PURE__ */ new Set();
	}
	connectedCallback() {
		super.connectedCallback(), F.opened(() => this.hass, document.visibilityState !== "hidden"), document.addEventListener("visibilitychange", this._onVisibility), document.addEventListener("fullscreenchange", this._onFullscreen), typeof ResizeObserver < "u" && (this._resize = new ResizeObserver((e) => {
			let t = e.at(-1);
			t && Math.abs(t.contentRect.width - this._width) >= 1 && (this._width = t.contentRect.width);
		}), this._resize.observe(this)), this._flush();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), document.removeEventListener("fullscreenchange", this._onFullscreen), this._resize?.disconnect(), this._resize = void 0, F.closed(), this._flush();
	}
	_onFullscreen = () => {
		this._boardFull = document.fullscreenElement === this;
	};
	_toggleBoardFull() {
		document.fullscreenElement === this ? document.exitFullscreen().catch(() => void 0) : this.requestFullscreen().catch(() => void 0);
	}
	_onVisibility = () => {
		let e = document.visibilityState !== "hidden";
		F.visibility(e), e || this._flush();
	};
	_flush() {
		this.hass && F.flush(this.hass);
	}
	willUpdate() {
		this._data.hass = this.hass;
	}
	updated() {
		let e = this._data.cameras;
		if (e && e !== this._announced) {
			this._announced = e;
			let t = Ir(e);
			this.dispatchEvent(new CustomEvent(Nr, {
				detail: { cameras: t },
				bubbles: !0,
				composed: !0
			}));
		}
	}
	render() {
		let e = this._data, t = e.cameras, n = document.fullscreenEnabled && typeof this.requestFullscreen == "function";
		return C`<div class="head">
        <h1>Live</h1>
        ${t?.length ? C`<p class="count">
              ${Fr(t, this._live, t.filter((e) => Lt(this.hass, P(e)) !== void 0).length)}
            </p>` : E}
        ${n && t?.length ? C`<button class="text with-icon full" @click=${() => {
			this._toggleBoardFull();
		}}>
              ${N(this._boardFull ? "exitFull" : "enterFull")}${this._boardFull ? "Exit full screen" : "Full screen"}
            </button>` : E}
      </div>
      ${e.error ? I(xt(e.error, "Live view"), e.error, {
			action: C`<button
              @click=${() => {
				e.reload();
			}}
            >
              Try again
            </button>`,
			help: "loading"
		}) : E}
      ${t === void 0 ? e.error ? E : C`<p class="note">Loading…</p>` : t.length === 0 ? C`<p class="note">No camera can be watched live.</p>` : this._renderGrid(t)}`;
	}
	_renderGrid(e) {
		let t = this._data, n = Lr(e), r = n.map((e) => zr(P(e))), i = r.reduce((e, t) => e + (t ? 2 : 1), 0), a = this._width, o = Math.max(2, Math.min(a >= 1100 ? 5 : a >= 800 ? 4 : a >= 540 ? 3 : 2, i)), s = a ? (a - (o - 1) * Mr) / o : 0, c = 9 / 16 * s;
		return C`<div
      class="grid"
      style=${`--cols: ${o}; --row: ${c ? `${c.toFixed(1)}px` : "auto"}`}
      @rv-live-open=${(e) => {
			q(this, {
				view: "device",
				id: e.detail.cameraId,
				tab: "live"
			});
		}}
      @rv-live-full=${(e) => {
			e.detail.full ? this._full = e.detail.cameraId : this._full === e.detail.cameraId && (this._full = void 0);
		}}
      @rv-live-count=${(e) => {
			F.count(e.detail.camera, e.detail.kind);
		}}
      @rv-live-state=${(e) => {
			let t = new Set(this._live);
			e.detail.live ? t.add(e.detail.cameraId) : t.delete(e.detail.cameraId), this._live = t;
		}}
    >
      ${n.map((e, n) => C`<rv-live-tile
            class=${r[n] ?? ""}
            fill
            .fit=${Rr(P(e), r[n], s)}
            .number=${n + 1}
            .hass=${this.hass}
            .camera=${e}
            .connection=${P(e)}
            .image=${t.images[e.id]}
            .iceServers=${t.iceServers}
            .warm=${It(this.hass, e)}
            .suspended=${this._full !== void 0 && this._full !== e.id}
            .controls=${e.controls}
            openable
          ></rv-live-tile>`)}
    </div>`;
	}
	static styles = [L, o`
      :host {
        display: block;
        padding: 16px 24px 28px;
        color: var(--rv-on-board);
        background: var(--rv-board);
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 14px;
        margin-bottom: 12px;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      .count,
      .note {
        margin: 0;
        color: var(--rv-on-board-muted);
        font-size: 15px;
      }
      button.full {
        margin-left: auto;
        color: var(--rv-on-board);
      }
      button.full:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
        grid-auto-rows: var(--row, auto);
        grid-auto-flow: dense;
        gap: ${Mr}px;
      }
      rv-live-tile.tall {
        grid-row: span 2;
      }
      rv-live-tile.wide {
        grid-column: span 2;
      }
      @media (max-width: 600px) {
        :host {
          padding: 12px 12px 20px;
        }
      }
    `];
};
function Fr(e, t, n = 0) {
	let r = e.filter((e) => t.has(e.id)).length, i = r ? `${String(r)} of ${String(e.length)} playing` : `${String(e.length)} ${e.length === 1 ? "camera" : "cameras"}`;
	return n ? `${i} · ${String(n)} offline` : i;
}
function Ir(e) {
	return Lr(e).map((e, t) => ({
		id: e.id,
		name: e.name,
		number: t + 1
	}));
}
function Lr(e) {
	let t = e.filter((e) => zr(P(e)) === "tall");
	return [...t, ...e.filter((e) => !t.includes(e))];
}
function Rr(e, t, n) {
	let r = Br(e);
	if (!r) return "cover";
	let i = n ? Mr / n : 0, a = 9 / 16;
	return r > (t === "tall" ? 1 / (2 * a + i) : t === "wide" ? (2 + i) / a : 1 / a) * 1.02 ? "contain" : "cover";
}
function zr(e) {
	let t = Br(e);
	if (t) {
		if (t < 1.2) return "tall";
		if (t > 2.4) return "wide";
	}
}
function Br(e) {
	let t = e?.streams.sub?.encoding, n = t?.width, r = t?.height;
	return n && r ? n / r : void 0;
}
var Vr = class extends A {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		_error: { state: !0 }
	};
	_data = new Ft(this);
	willUpdate() {
		this._data.hass = this.hass;
	}
	render() {
		let e = this._data;
		if (e.error) return C`<div class="banner error" role="alert">
        Could not load live view: ${e.error}
        <button
          @click=${() => {
			e.reload();
		}}
        >
          Retry
        </button>
      </div>`;
		if (!e.cameras) return C`<p class="muted">Loading…</p>`;
		let t = Rt(e.cameras, this.deviceId);
		return t ? C`<div class="board">
        <rv-live-tile
          .hass=${this.hass}
          .camera=${t}
          .connection=${P(t)}
          .image=${e.images[t.id]}
          .iceServers=${e.iceServers}
          .warm=${It(this.hass, t)}
          .controls=${t.controls}
        ></rv-live-tile>
      </div>
      ${this._renderKeepWarm(t)}` : C`<p class="muted">This camera cannot be watched live.</p>`;
	}
	_renderKeepWarm(e) {
		let t = e.keep_warm_entity;
		if (!t) return E;
		let n = this.hass?.states[t]?.state;
		return C`<label class="keep-warm">
      <input
        type="checkbox"
        aria-labelledby="keep-warm-name"
        aria-describedby="keep-warm-about"
        .checked=${n === "on"}
        ?disabled=${n !== "on" && n !== "off"}
        @change=${(e) => {
			let n = e.target.checked;
			this.hass?.callService("switch", n ? "turn_on" : "turn_off", { entity_id: t }).catch((e) => {
				this._error = j(e).message;
			});
		}}
      />
      <span>
        <strong id="keep-warm-name">Keep warm</strong>
        <span class="muted small" id="keep-warm-about"
          >Keeps the camera connected so its live view starts at once. Uses one of
          its NVR's or camera's stream slots all the time.</span
        >
      </span>
    </label>
    ${this._error ? C`<div class="banner error" role="alert">Could not change it: ${this._error}</div>` : E}`;
	}
	static styles = [L, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 1280px;
      }
      /* Video sits on the board's ink, with a margin of it. */
      .board {
        padding: 10px;
        background: var(--rv-board);
      }
      .keep-warm {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .keep-warm > span {
        display: flex;
        flex-direction: column;
      }
    `];
};
customElements.get("rv-live-grid") || customElements.define("rv-live-grid", Pr), customElements.get("rv-live-camera") || customElements.define("rv-live-camera", Vr);
//#endregion
//#region src/playback/timeline-math.ts
var J = 6e4, Y = 60 * J, Hr = 24 * Y, X = [
	Hr,
	6 * Y,
	Y,
	15 * J,
	5 * J
];
function Ur(e, t, n) {
	return (e - t.start) / t.span * n;
}
function Wr(e, t, n) {
	return t.start + e / n * t.span;
}
function Gr(e, t) {
	let n = t.end - t.start, r = X[X.length - 1] ?? 6e4, i = Math.min(Math.max(e.span, r), Math.max(n, r));
	return i >= n ? {
		start: t.start,
		span: n
	} : {
		start: Math.min(Math.max(e.start, t.start), t.end - i),
		span: i
	};
}
function Kr(e, t, n, r) {
	return Gr({
		start: n - (n - e.start) / e.span * t,
		span: t
	}, r);
}
function qr(e, t) {
	let n = e * .01;
	return t > 0 ? X.find((t) => t < e - n) : [...X].reverse().find((t) => t > e + n);
}
function Jr(e, t, n) {
	return Gr({
		start: t - e.span / 2,
		span: e.span
	}, n);
}
var Yr = [
	1e4,
	3e4,
	J,
	5 * J,
	10 * J,
	15 * J,
	30 * J,
	Y,
	2 * Y,
	3 * Y,
	6 * Y
];
function Xr(e, t, n = 60) {
	for (let r of Yr) if (r / e.span * t >= n) return r;
	return Yr[Yr.length - 1] ?? 36e5;
}
function Zr(e, t, n) {
	let r = Xr(e, t), i = [], a = e.start + e.span, o = n(e.start), s = Math.ceil((e.start + o) / r) * r - o;
	for (let e = 0; s <= a && e < 500; e += 1) i.push(s), s += r;
	return i;
}
function Qr(e, t, n, r = 1) {
	let i = r / n * t.span, a = t.start + t.span, o = [];
	for (let n of e) {
		if (n.end < t.start || n.start > a) continue;
		let e = o.at(-1);
		e && n.start - e.end <= i ? e.end = Math.max(e.end, n.end) : o.push({
			start: n.start,
			end: n.end
		});
	}
	return o;
}
function $r(e, t) {
	let n = 0, r = e.length - 1, i;
	for (; n <= r;) {
		let a = n + r >> 1, o = e.at(a);
		if (!o) break;
		o.start <= t ? (t < o.end && (i = o), n = a + 1) : r = a - 1;
	}
	return i;
}
function ei(e, t) {
	return e.find((e) => e.start > t);
}
function ti(e, t) {
	let n = $r(e, t);
	if (n) return {
		segment: n,
		offset: t - n.start
	};
	let r = ei(e, t);
	return r ? {
		segment: r,
		offset: 0
	} : void 0;
}
function ni(e, t) {
	return t.size === 0 ? e : e.filter((e) => Q(e.types).some((e) => t.has(e)));
}
function ri(e, t) {
	return e.find((e) => e.start > t + 500);
}
function ii(e, t) {
	let n;
	for (let r of e) if (r.start < t - 1500) n = r;
	else break;
	return n;
}
var ai = [
	{
		type: "PERSON",
		label: "Person"
	},
	{
		type: "VEHICLE",
		label: "Vehicle"
	},
	{
		type: "ANIMAL",
		label: "Animal"
	},
	{
		type: "CROSSLINE",
		label: "Line crossing"
	},
	{
		type: "INTRUSION",
		label: "Intrusion"
	},
	{
		type: "LINGER",
		label: "Loitering"
	},
	{
		type: "FACE",
		label: "Face"
	},
	{
		type: "DOORBELL",
		label: "Doorbell"
	},
	{
		type: "PACKAGE",
		label: "Package"
	},
	{
		type: "FORGOTTEN_ITEM",
		label: "Item left"
	},
	{
		type: "TAKEN_ITEM",
		label: "Item taken"
	},
	{
		type: "CRYING",
		label: "Crying"
	},
	{
		type: "IO",
		label: "Alarm input"
	},
	{
		type: "MOTION",
		label: "Motion"
	},
	{
		type: "TIMER",
		label: "Scheduled"
	}
], Z = new Map(ai.map((e, t) => [e.type, t]));
function oi(e) {
	let t;
	for (let n of e) (t === void 0 || (Z.get(n) ?? 99) < (Z.get(t) ?? 99)) && (t = n);
	return t ?? "MOTION";
}
function si(e) {
	return ai[Z.get(e) ?? -1]?.label ?? e.toLowerCase();
}
function ci(e) {
	return [...e].sort((e, t) => (Z.get(e) ?? 99) - (Z.get(t) ?? 99));
}
function Q(e) {
	let t = e.filter((e) => e !== "MOTION");
	return ci(t.length ? t : e.length ? e : ["MOTION"]);
}
function li(e) {
	return ci(new Set(e.flatMap((e) => Q(e.types))));
}
function ui(e) {
	return e >= 216e5 ? 300 : e >= 36e5 ? 60 : e >= 9e5 ? 10 : 5;
}
function di(e, t, n) {
	let r = new Date(Date.UTC(e, t - 1, 1)).getUTCDay(), i = new Date(Date.UTC(e, t, 0)).getUTCDate(), a = (r - n % 7 + 7) % 7, o = [...Array.from({ length: a }, () => null), ...Array.from({ length: i }, (e, t) => t + 1)];
	for (; o.length % 7;) o.push(null);
	let s = [];
	for (let e = 0; e < o.length; e += 7) s.push(o.slice(e, e + 7));
	return s;
}
function fi(e, t, n) {
	let r = e * 12 + (t - 1) + n;
	return [Math.floor(r / 12), r % 12 + 1];
}
function pi(e, t, n) {
	return `${String(e).padStart(4, "0")}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
var mi = 12e4, hi = 3600, gi = 10, _i = "rv-timetable-feed", vi = class extends A {
	static properties = {
		hass: { attribute: !1 },
		cameras: { attribute: !1 },
		date: { attribute: !1 },
		heading: { attribute: !1 },
		limit: { attribute: !1 },
		cameraFilter: { attribute: !1 },
		typeFilter: { attribute: !1 },
		filters: { attribute: !1 },
		_feed: { state: !0 },
		_pick: { state: !0 },
		_error: { state: !0 },
		_all: { state: !0 },
		_thumbs: { state: !0 },
		_now: { state: !0 }
	};
	_seq = 0;
	_refresh;
	_clock;
	_thumbsAsked = /* @__PURE__ */ new Set();
	_newestBefore;
	constructor() {
		super(), this.cameras = [], this.heading = "Today", this.limit = 8, this.cameraFilter = /* @__PURE__ */ new Set(), this.typeFilter = /* @__PURE__ */ new Set(), this.filters = !1, this._pick = /* @__PURE__ */ new Set(), this._all = !1, this._thumbs = /* @__PURE__ */ new Map(), this._now = Date.now();
	}
	connectedCallback() {
		super.connectedCallback(), document.addEventListener("visibilitychange", this._onVisibility), this._refresh = setInterval(() => {
			document.visibilityState !== "hidden" && this._isToday && this._load(!0);
		}, mi), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), clearInterval(this._refresh), clearTimeout(this._clock);
	}
	_onVisibility = () => {
		document.visibilityState !== "hidden" && this._feed && this._isToday && this._load(!0);
	};
	_tick() {
		this._now = Date.now(), clearTimeout(this._clock), this._clock = setTimeout(() => {
			this._tick();
		}, 6e4 - this._now % 6e4 + 50);
	}
	get _isToday() {
		return this.date === void 0 || this.date === er(this._now, this.hass?.config?.time_zone);
	}
	willUpdate(e) {
		e.has("date") && e.get("date") !== void 0 && (this._feed = void 0, this._error = void 0, this._all = !1, this._newestBefore = void 0);
	}
	updated(e) {
		let t = e.has("hass") && this.hass && !this._feed && this._seq === 0, n = e.has("date") && e.get("date") !== void 0;
		(t || n) && this._load(!1).then(() => this._isToday ? this._load(!0) : void 0), (e.has("cameraFilter") || e.has("typeFilter") || e.has("_pick")) && this._loadThumbs();
	}
	async _load(e) {
		let t = this.hass;
		if (!t) return;
		let n = ++this._seq, r = this.date;
		try {
			let i = await Ge(t, {
				...r === void 0 ? {} : { date: r },
				...e ? { background: e } : { maxAge: hi }
			});
			if (n !== this._seq || r !== this.date) return;
			this._newestBefore = e ? this._feed?.events[0]?.start : void 0, this._feed = i, this._error = void 0, this.dispatchEvent(new CustomEvent(_i, { detail: { feed: i } })), this._loadThumbs();
		} catch (e) {
			n === this._seq && (this._error = j(e).message);
		}
	}
	get _matching() {
		let e = this.cameraFilter.size ? this.cameraFilter : this._pick, t = this.typeFilter;
		return (this._feed?.events ?? []).filter((n) => (!e.size || e.has(n.camera_id)) && (!t.size || Q(n.types).some((e) => t.has(e))));
	}
	get _shown() {
		let e = this._matching;
		return this._all ? e : e.slice(0, this.limit);
	}
	async _loadThumbs() {
		let e = this.hass;
		if (!e) return;
		let t = /* @__PURE__ */ new Map();
		for (let e of this._shown) {
			let n = bi(e);
			this._thumbsAsked.has(n) || (this._thumbsAsked.add(n), t.set(e.camera_id, [...t.get(e.camera_id) ?? [], e.start]));
		}
		await Promise.all([...t].map(async ([t, n]) => {
			try {
				let { urls: r } = await nt(e, t, n, gi), i = new Map(this._thumbs);
				r.forEach((e, r) => i.set(`${t}:${String(n[r] ?? e.time)}`, e.url)), this._thumbs = i;
			} catch {}
		}));
	}
	_open(e) {
		let t = this.hass;
		t && e.new && (this._markOpened(e), qe(t, e.camera_id, e.start).catch(() => void 0)), q(this, {
			view: "device",
			id: e.camera_id,
			tab: "playback",
			at: e.start
		});
	}
	_markOpened(e) {
		let t = this._feed;
		t && (this._feed = {
			...t,
			events: t.events.map((t) => t === e ? {
				...t,
				new: !1
			} : t)
		});
	}
	async _allSeen() {
		let e = this.hass, t = this._feed;
		if (e && t) {
			this._feed = {
				...t,
				events: t.events.map((e) => ({
					...e,
					new: !1
				}))
			};
			try {
				await Je(e);
			} catch (e) {
				this._error = j(e).message;
			}
		}
	}
	render() {
		let e = this._feed, t = this._matching, n = this.hass?.config?.time_zone, r = new Set(t.map((e) => e.camera_id)).size, i = this.cameraFilter.size > 0 || this.typeFilter.size > 0 || this._pick.size > 0, a = this._isToday ? "today's" : "this day's";
		return C`<div class="head">
        ${this.heading ? C`<h2>${this.heading}</h2>` : E}
        ${e ? C`<p class="count">
              ${t.length ? `${String(t.length)} ${t.length === 1 ? "event" : "events"} on ${String(r)} ${r === 1 ? "camera" : "cameras"}` : i ? "None match" : this._isToday ? "No events yet" : "No events"}
            </p>` : E}
        ${(e?.events ?? []).some((e) => e.new) ? C`<button class="text all-seen" @click=${() => void this._allSeen()}>Mark all seen</button>` : E}
        ${this.filters ? C`<button class="text with-icon all-events" @click=${() => {
			q(this, { view: "events" });
		}}>All events${N("chevron")}</button>` : E}
      </div>
      ${this.filters && e ? this._renderPick(e) : E}
      ${this._error ? I(xt(this._error, this._isToday ? "Today's events" : "This day's events"), this._error, {
			action: C`<button @click=${() => void this._load(!1)}>Try again</button>`,
			help: "loading"
		}) : E}
      ${e ? this._renderTable(e, n) : this._error ? E : C`<p class="muted">Reading ${a} events…</p>`}`;
	}
	_renderPick(e) {
		let t = new Set(e.events.map((e) => e.camera_id)), n = this.cameras.filter((e) => t.has(e.id) || this._pick.has(e.id));
		return n.length < 2 ? E : C`<div class="pick" role="group" aria-label="Cameras">
      ${n.map((e) => C`<button
          class="chip"
          aria-pressed=${this._pick.has(e.id) ? "true" : "false"}
          @click=${() => {
			let t = new Set(this._pick);
			t.delete(e.id) || t.add(e.id), this._pick = t;
		}}
        >
          <span class="plat" aria-hidden="true">${e.number}</span>${e.name}
        </button>`)}
    </div>`;
	}
	_renderTable(e, t) {
		let n = this._matching, r = new Map(this.cameras.map((e) => [e.id, e])), i = n.length - this._shown.length, a = this._isToday, o = e.events.length ? "No events match these filters." : a ? "Nothing recorded an event since midnight." : "Nothing recorded an event on this day.";
		return C`<div class="cols" aria-hidden="true">
        <span>Time</span><span>Event</span><span>Camera</span><span class="right">Length</span><span></span>
      </div>
      ${a ? C`<div class="now"><b>${V(this._now, t)} now</b></div>` : E}
      ${n.length ? C`<ol class="rows">
            ${this._shown.map((e) => this._renderRow(e, r.get(e.camera_id), t))}
          </ol>` : C`<p class="muted empty">${o}</p>`}
      ${i > 0 ? C`<button
            class="text more"
            @click=${() => {
			this._all = !0, this.updateComplete.then(() => this._loadThumbs());
		}}
          >
            Show all ${n.length} events
          </button>` : E}
      ${e.failed.length ? C`<p class="failed">
            ${yi(e.failed.map((e) => r.get(e.camera_id)?.name ?? "A camera"), a)}
          </p>` : E}`;
	}
	_renderRow(e, t, n) {
		let r = Si(e.types), i = V(e.start, n), a = t?.name ?? "Camera", o = this._thumbs.get(bi(e));
		return C`<li class=${this._newestBefore !== void 0 && e.start > this._newestBefore ? "arrived" : ""}>
      <button
        class="row ${e.new ? "new" : ""}"
        @click=${() => {
			this._open(e);
		}}
      >
        <span class="t">${i}</span>
        <span class="ev">
          ${N(Ci(e.types))}<span>${r}</span>${e.new ? C`<span class="tag">New</span>` : E}
        </span>
        <span class="cam">${xi(t)}<span class="name">${a}</span></span>
        <span class="len">${wi(e.end - e.start)}</span>
        <span class="thumb">${o ? C`<img src=${o} alt="" loading="lazy" />` : E}</span>
        <span class="meta">${xi(t)}${a} · ${wi(e.end - e.start)}</span>
      </button>
    </li>`;
	}
	static styles = [L, o`
      :host {
        display: block;
        padding: 18px 24px 40px;
        container-type: inline-size;
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 14px;
        margin-bottom: 12px;
      }
      h2 {
        margin: 0;
        font-size: 26px;
      }
      .count {
        margin: 0;
        color: var(--rv-muted);
        font-size: 15px;
      }
      .all-seen {
        margin-left: auto;
      }
      .all-events {
        gap: 2px;
        padding-right: 0;
      }
      .all-seen + .all-events {
        margin-left: 8px;
      }
      .count + .all-events {
        margin-left: auto;
      }
      .all-events svg {
        width: 18px;
        height: 18px;
      }
      .pick {
        display: flex;
        gap: 6px;
        margin: -2px 0 14px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .chip {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 0 12px 0 5px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip .plat {
        min-width: 22px;
        height: 22px;
        font-size: 14px;
      }
      .chip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .chip[aria-pressed="true"]:hover {
        background: var(--rv-text);
      }
      .cols,
      .row {
        display: grid;
        grid-template-columns: 96px minmax(0, 1.3fr) minmax(0, 1fr) 80px 104px;
        column-gap: 20px;
        align-items: center;
      }
      .cols {
        padding: 0 8px 6px;
        border-bottom: 1px solid var(--rv-rule-strong);
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      .right {
        text-align: right;
      }
      .now {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 30px;
        color: var(--rv-red);
      }
      .now b {
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
      }
      .now::after {
        content: "";
        flex: 1;
        height: 2px;
        background: var(--rv-red);
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        width: 100%;
        min-height: 62px;
        padding: 0 8px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .t {
        font-family: var(--rv-font-cond);
        font-size: 32px;
        font-weight: 600;
        line-height: 1;
      }
      .new .t {
        color: var(--rv-red);
      }
      .ev {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        font-size: 17px;
        font-weight: 500;
      }
      .ev svg {
        width: 22px;
        height: 22px;
        flex: none;
      }
      .tag {
        color: var(--rv-red);
        font-size: 13px;
        font-weight: 600;
      }
      .cam {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        font-size: 16px;
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .plat {
        flex: none;
        min-width: 26px;
        height: 26px;
        padding: 0 4px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .len {
        text-align: right;
        color: var(--rv-muted);
        font-size: 16px;
      }
      .thumb {
        width: 104px;
        height: 58px;
        background: var(--rv-ground-2);
        overflow: hidden;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .meta {
        display: none;
      }
      .arrived {
        animation: arrive 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes arrive {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
      }
      .more {
        margin-top: 10px;
      }
      .empty {
        padding: 14px 8px;
      }
      .failed {
        margin: 12px 0 0;
        padding: 8px 12px;
        background: var(--rv-fault);
        color: var(--rv-on-fault);
        font-size: 14px;
      }
      @container (max-width: 640px) {
        h2 {
          font-size: 22px;
        }
        .cols {
          display: none;
        }
        .row {
          grid-template-columns: 58px minmax(0, 1fr) 84px;
          column-gap: 12px;
          padding: 8px 4px;
          grid-template-areas: "t ev thumb" "t meta thumb";
        }
        .t {
          grid-area: t;
          font-size: 24px;
        }
        .ev {
          grid-area: ev;
          font-size: 15px;
        }
        .ev svg {
          width: 18px;
          height: 18px;
        }
        .cam,
        .len {
          display: none;
        }
        .thumb {
          grid-area: thumb;
          width: 84px;
          height: 47px;
        }
        .meta {
          grid-area: meta;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          color: var(--rv-muted);
          font-size: 14px;
        }
        .meta .plat {
          min-width: 20px;
          height: 20px;
          font-size: 13px;
        }
      }
      @media (max-width: 600px) {
        :host {
          padding: 14px 12px 32px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .arrived {
          animation: none;
        }
      }
    `];
};
function yi(e, t) {
	return `${e.join(", ")}: ${t ? "today's" : "this day's"} recordings could not be searched, so some events may be missing.`;
}
function bi(e) {
	return `${e.camera_id}:${String(e.start)}`;
}
function xi(e) {
	return e ? C`<span class="plat" aria-hidden="true">${e.number}</span>` : E;
}
function Si(e) {
	return Q(e).map(si).join(" · ");
}
function Ci(e) {
	if (e.includes("DOORBELL")) return "visitor";
	switch (oi(e)) {
		case "PERSON":
		case "FACE": return "person";
		case "VEHICLE": return "vehicle";
		case "ANIMAL": return "animal";
		case "PACKAGE":
		case "FORGOTTEN_ITEM":
		case "TAKEN_ITEM": return "package";
		default: return "motion";
	}
}
function wi(e) {
	let t = Math.max(0, Math.round(e / 1e3)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = String(t % 60).padStart(2, "0");
	return n ? `${String(n)}:${String(r).padStart(2, "0")}:${i}` : `${String(r)}:${i}`;
}
customElements.get("rv-timetable") || customElements.define("rv-timetable", vi);
//#endregion
//#region src/download.ts
function Ti(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/fonts.ts
var Ei = [
	[
		"Barlow",
		400,
		"barlow-400.woff2"
	],
	[
		"Barlow",
		500,
		"barlow-500.woff2"
	],
	[
		"Barlow",
		600,
		"barlow-600.woff2"
	],
	[
		"Barlow Semi Condensed",
		500,
		"barlow-semi-condensed-500.woff2"
	],
	[
		"Barlow Semi Condensed",
		600,
		"barlow-semi-condensed-600.woff2"
	]
], Di = "reolink-viewer-fonts";
function Oi(e, t = document) {
	if (t.getElementById(Di)) return;
	let n = t.createElement("style");
	n.id = Di, n.textContent = Ei.map(([t, n, r]) => `@font-face{font-family:"${t}";font-style:normal;font-weight:${n};font-display:swap;src:url("${new URL(`fonts/${r}`, e).href}") format("woff2");}`).join("\n"), t.head.appendChild(n);
}
//#endregion
//#region src/format.ts
var ki = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, Ai = (e) => ki[e];
function ji(e) {
	let t = [];
	return e.codec && t.push(Mi(e.codec)), e.width && e.height && t.push(`${e.width}×${e.height}`), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function Mi(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function Ni(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function Pi(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
function Fi(e) {
	return e.via === "nvr" ? `Through ${e.host_name ?? e.entry_title}` : "Added directly";
}
//#endregion
//#region src/views.ts
var Ii = {
	events: () => import("./events-view-CmU-xTml.js"),
	list: () => import("./device-list-Dl0qdtAO.js"),
	device: () => import("./device-page-C_r_yxy8.js"),
	"live-check": () => import("./live-check-B_YBk9EP.js"),
	soak: () => import("./live-soak-C5-sRkcn.js")
}, Li = /* @__PURE__ */ new Map();
function $(e) {
	let t = Ii[e];
	if (!t) return Promise.resolve();
	let n = Li.get(e);
	return n || (n = t().catch((t) => {
		throw Li.delete(e), t;
	}), Li.set(e, n)), n;
}
//#endregion
//#region src/reolink-viewer-panel.ts
var Ri = {
	live: "Live",
	events: "Events",
	list: "Devices",
	device: "Device",
	"live-check": "Live check",
	soak: "Soak report"
}, zi = 6e3, Bi = class extends A {
	static properties = {
		hass: { attribute: !1 },
		narrow: {
			type: Boolean,
			reflect: !0
		},
		_now: { state: !0 },
		_board: { state: !0 },
		_devices: { state: !0 },
		_loadError: { state: !0 },
		_probe: { state: !0 },
		_includeBattery: { state: !0 },
		_concurrency: { state: !0 },
		_maxStreams: { state: !0 },
		_playback: { state: !0 },
		_playbackOnly: { state: !0 },
		_playbackConcurrency: { state: !0 },
		_playbackStreams: { state: !0 },
		_baichuan: { state: !0 },
		_copied: { state: !0 },
		_route: { state: !0 },
		_toast: { state: !0 },
		_viewError: { state: !0 }
	};
	_run;
	_loading = !1;
	_warmed = !1;
	_toastTimer;
	_clockTimer;
	_onHashChange = () => {
		this._route = jr(window.location.hash);
	};
	constructor() {
		super(), this.narrow = !1, this._now = Date.now(), this._board = [], this._probe = { status: "idle" }, this._includeBattery = !1, this._concurrency = !1, this._maxStreams = 4, this._playback = !1, this._playbackOnly = !1, this._playbackConcurrency = !1, this._playbackStreams = 4, this._baichuan = !1, this._copied = !1, this._route = { view: "live" }, this.addEventListener(Dr, (e) => {
			this.navigate(e.detail);
		}), this.addEventListener(Or, (e) => {
			this.showToast(e.detail);
		});
	}
	connectedCallback() {
		super.connectedCallback(), Oi(import.meta.url), this._route = jr(window.location.hash), window.addEventListener("hashchange", this._onHashChange), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("hashchange", this._onHashChange), clearTimeout(this._toastTimer), clearTimeout(this._clockTimer), this._run?.cancel(), this._run = void 0;
	}
	_tick() {
		this._now = Date.now(), clearTimeout(this._clockTimer), this._clockTimer = setTimeout(() => {
			this._tick();
		}, 6e4 - this._now % 6e4 + 50);
	}
	willUpdate(e) {
		if (this.toggleAttribute("dark", this.hass?.themes?.darkMode === !0), e.has("_route")) {
			let e = this._route.view;
			this._viewError = void 0, $(e).catch((t) => {
				this._route.view === e && (this._viewError = j(t).message);
			});
		}
	}
	updated(e) {
		if (e.has("hass") && this.hass && !this._devices && !this._loading && (this._load(), Be(this.hass).catch(() => void 0)), e.get("_route") !== void 0 && !this.shadowRoot?.activeElement) {
			let e = document.activeElement;
			(!e || e === document.body) && this.shadowRoot?.querySelector("main")?.focus({ preventScroll: !0 });
		}
	}
	navigate(e) {
		let t = Ar(e);
		if (window.location.hash !== t) {
			let e = `${window.location.pathname}${window.location.search}${t}`;
			window.history.pushState(null, "", e);
		}
		e.view === "list" && this._route.view !== "list" && this._load(), this._route = e;
	}
	showToast(e) {
		clearTimeout(this._toastTimer), this._toast = e, this._toastTimer = setTimeout(() => {
			this._toast = void 0;
		}, zi);
	}
	async _load() {
		if (this.hass) {
			this._loading = !0;
			try {
				this._devices = await Le(this.hass), this._loadError = void 0, !this._board.length && !this._devices.degraded && at(this.hass).then(({ cameras: e }) => {
					this._board.length || (this._board = Ir(e));
				}).catch(() => void 0), !this._warmed && !this._devices.degraded && (this._warmed = !0, Ye(this.hass).catch(() => void 0));
			} catch (e) {
				this._loadError = j(e).message;
			} finally {
				this._loading = !1;
			}
		}
	}
	get _isAdmin() {
		return this.hass?.user?.is_admin === !0;
	}
	render() {
		let e = this._route;
		return C`
      <header class="band">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">Reolink</div>
        <nav aria-label="Reolink">
          ${this._renderTab("Live", { view: "live" }, e.view === "live")}
          ${this._renderTab("Events", { view: "events" }, e.view === "events")}
          ${this._renderTab("Devices", { view: "list" }, e.view !== "live" && e.view !== "events")}
        </nav>
        <time class="clock" aria-label="Time">
          ${V(this._now, this.hass?.config?.time_zone)}
        </time>
      </header>
      <main
        class=${e.view === "live" || e.view === "events" ? "wide" : "page"}
        tabindex="-1"
        aria-label=${Ri[e.view]}
      >${this._renderView()}</main>
      ${this._toast ? C`<div class="toast ${this._toast.kind}" role="status" aria-live="polite">
            <span>${this._toast.message}</span>
            <button class="dismiss" aria-label="Dismiss" @click=${() => {
			this._toast = void 0;
		}}>${N("close")}</button>
          </div>` : E}
    `;
	}
	_renderTab(e, t, n) {
		return C`<button
      class="tab"
      aria-current=${n ? "page" : E}
      @click=${() => {
			this.navigate(t);
		}}
    >
      ${e}
    </button>`;
	}
	_renderView() {
		let e = this._route;
		if (this._viewError) return C`<div class="banner error" role="alert">
        Could not load this page: ${this._viewError}. Check the connection to Home Assistant, then
        <button
          @click=${() => {
			this._viewError = void 0, $(e.view).catch((e) => {
				this._viewError = j(e).message;
			});
		}}
        >
          Try again
        </button>
      </div>`;
		let t = yt(this._devices), n = t ? this._renderIntegration(t) : E;
		switch (e.view) {
			case "live": return t ? C`<div class="wide-note">${n}</div>` : C`<rv-live-grid
            .hass=${this.hass}
            @rv-board=${(e) => {
				this._board = e.detail.cameras;
			}}
          ></rv-live-grid>
          <rv-timetable .hass=${this.hass} .cameras=${this._board} .filters=${!0}></rv-timetable>`;
			case "events": return t ? C`<div class="wide-note">${n}</div>` : C`<rv-events .hass=${this.hass} .cameras=${this._board} .date=${e.date}></rv-events>`;
			case "device": return C`${n}<rv-device-page
          .hass=${this.hass}
          .cameras=${this._board}
          .devices=${this._devices}
          .deviceId=${e.id}
          .tab=${e.tab}
          .at=${e.at}
        ></rv-device-page>`;
			case "live-check": return C`${this._renderBack()}
          <h1>Live check</h1>
          ${n}
          <rv-live-check .hass=${this.hass}></rv-live-check>`;
			case "soak": return C`${this._renderBack()}
          <h1>Soak report</h1>
          ${n}
          <rv-live-soak .hass=${this.hass}></rv-live-soak>`;
			case "list": return C`<div class="heading">
            <h1>Devices</h1>
            <button class="text with-icon" @click=${() => void this._load()} ?disabled=${this._loading}>
              ${N("refresh")}Refresh
            </button>
          </div>
          ${this._renderBanner()}
          ${this._loadError ? E : C`<rv-device-list .devices=${this._devices} .cameras=${this._board}></rv-device-list>`}
          ${this._renderChecks()} ${this._renderThisDevice()} ${this._renderHelp()}
          ${this._isAdmin ? this._renderProbe() : E}`;
		}
	}
	_renderBack() {
		return C`<div>
      <button class="text with-icon back" @click=${() => {
			this.navigate({ view: "list" });
		}}>${N("back")}All devices</button>
    </div>`;
	}
	_renderBanner() {
		if (this._loadError) return I(xt(this._loadError, "Your devices"), this._loadError, {
			action: C`<button @click=${() => void this._load()} ?disabled=${this._loading}>Try again</button>`,
			help: "loading"
		});
		let e = yt(this._devices);
		return !e || e.kind === "none" ? E : this._renderIntegration(e);
	}
	_renderIntegration(e) {
		let t = e.kind !== "none";
		return C`<section class="integration ${t ? "fault" : ""}" role=${t ? "alert" : "status"}>
      <h2>${e.title}</h2>
      <p class="what">${e.text}</p>
      <p>${e.advice}</p>
      <div class="actions">
        <button class="check" @click=${() => void this._load()} ?disabled=${this._loading}>
          ${N("refresh")}${this._loading ? "Checking…" : "Check again"}
        </button>
        ${Gt(e.kind)}
      </div>
      ${e.technical ? C`<details>
            <summary>Details</summary>
            <span class="technical">${e.technical}</span>
          </details>` : E}
    </section>`;
	}
	_renderChecks() {
		if (!this._devices || this._devices.degraded) return E;
		let e = (e, t, n) => C`<li>
      <button
        class="row"
        @click=${() => {
			this.navigate(n);
		}}
      >
        <span class="what"><span class="name">${e}</span><span class="muted">${t}</span></span>
        ${N("chevron")}
      </button>
    </li>`;
		return C`<section class="card">
      <h2>Checks</h2>
      <p class="muted">See how well live view works on your devices, in plain words.</p>
      <ul class="checks">
        ${e("Live check", "How quickly each camera's live video starts on this device. Takes a few minutes.", { view: "live-check" })}
        ${e("Soak report", "Whether live view keeps working through a day of use: video that drops, connections that pile up, battery cameras that stay awake.", { view: "soak" })}
      </ul>
      <p class="muted small">
        To check recordings, open a camera's Playback tab, then “Details and playback check” under the
        player.
      </p>
    </section>`;
	}
	_renderThisDevice() {
		let e = (e, t, n) => {
			let r = qn({
				where: e,
				why: ""
			}).hd;
			return C`<label class="option">
        <span
          >${t}
          <select
            aria-label=${t}
            @change=${(t) => {
				Jn(e, t.target.value === "hd"), this.requestUpdate();
			}}
          >
            <option value="hd" ?selected=${r}>${n[0]}</option>
            <option value="sd" ?selected=${!r}>${n[1]}</option>
          </select></span
        >
      </label>`;
		};
		return C`<section class="card">
      <h2>This device</h2>
      <p class="muted">How a camera plays in full screen here. Each phone and computer keeps its own.</p>
      <div class="options">
        ${e("home", "At home, full screen starts in", ["HD", "SD"])}
        ${e("away", "Away from home or on mobile data, it starts in", ["HD", "the lighter SD"])}
        <label class="option">
          <input
            type="checkbox"
            .checked=${Xn()}
            @change=${(e) => {
			Zn(e.target.checked), this.requestUpdate();
		}}
          />
          <span
            >Remember HD or SD when I tap it in full screen
            <span class="muted">(off: full screen starts as set here every time)</span></span
          >
        </label>
      </div>
    </section>`;
	}
	_renderHelp() {
		let e = (e, t, n) => C`<li>
      <a class="row" href=${Wt(n)} target="_blank" rel="noopener noreferrer">
        <span class="what"><span class="name">${e}</span><span class="muted">${t}</span></span>
        ${N("external")}
      </a>
    </li>`;
		return C`<section class="card">
      <h2>Help</h2>
      <p class="muted">The guides to this version of Reolink Viewer (${Vt}). They open in a new tab.</p>
      <ul class="checks">
        ${e("User guide", "What each part of the panel does, and how to use it.", "guide")}
        ${e("Troubleshooting", "What a message means, and what to do about it.", "troubleshooting")}
        ${e("Cameras and NVRs", "What to expect from each Reolink model, and the camera settings that help.", "cameras")}
      </ul>
    </section>`;
	}
	_renderProbe() {
		let e = this._probe.status === "running", t = e || !this._devices || this._devices.degraded;
		return C`<section class="card">
      <h2>Hardware probe</h2>
      <p>
        Tests which ways of getting live and recorded video work on each of your cameras, and how fast
        they are. Run it when you report a problem with a camera model: it makes a file to attach to
        your report.
      </p>
      <p class="muted">
        It only reads from your cameras and changes no settings. Passwords, addresses, serial numbers and
        other private details are left out of the file.
      </p>
      <div class="options">
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._includeBattery}
            ?disabled=${e}
            @change=${(e) => {
			this._includeBattery = e.target.checked;
		}}
          />
          <span>Include battery cameras <span class="muted">(this wakes them, which uses some battery)</span></span>
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._concurrency}
            ?disabled=${e}
            @change=${(e) => {
			this._concurrency = e.target.checked;
		}}
          />
          <span
            >Test several live streams at once: up to
            <select
              aria-label="Most live streams at once"
              .value=${String(this._maxStreams)}
              ?disabled=${e || !this._concurrency}
              @change=${(e) => {
			this._maxStreams = Number(e.target.value);
		}}
            >
              ${[
			2,
			3,
			4,
			5,
			6
		].map((e) => C`<option value=${e} ?selected=${e === this._maxStreams}>${e}</option>`)}
            </select>
            on one camera of each device, stopping at the first that fails</span
          >
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._playback}
            ?disabled=${e}
            @change=${(e) => {
			this._playback = e.target.checked;
		}}
          />
          <span>Test recordings: how they download and play, on one recent recording per camera</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._playbackOnly}
            ?disabled=${e || !this._playback}
            @change=${(e) => {
			this._playbackOnly = e.target.checked;
		}}
          />
          <span>Only test recordings (skip the live video tests)</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._playbackConcurrency}
            ?disabled=${e || !this._playback}
            @change=${(e) => {
			this._playbackConcurrency = e.target.checked;
		}}
          />
          <span
            >Test several recordings at once: up to
            <select
              aria-label="Most recordings at once"
              .value=${String(this._playbackStreams)}
              ?disabled=${e || !this._playback || !this._playbackConcurrency}
              @change=${(e) => {
			this._playbackStreams = Number(e.target.value);
		}}
            >
              ${[
			2,
			3,
			4,
			5,
			6
		].map((e) => C`<option value=${e} ?selected=${e === this._playbackStreams}>${e}</option>`)}
            </select>
            , one per camera, stopping at the first that fails</span
          >
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._baichuan}
            ?disabled=${e}
            @change=${(e) => {
			this._baichuan = e.target.checked;
		}}
          />
          <span
            >Test replay over the Reolink app's own protocol (Phase 5a): start a recording of a
            recorder 45 minutes in over Baichuan and over HTTP, and compare. Read-only, a few
            seconds of video.</span
          >
        </label>
      </div>
      <div class="actions">
        ${e ? C`<button @click=${() => {
			this._cancelProbe();
		}}>
              Cancel
            </button>` : C`<button class="primary" ?disabled=${t} @click=${() => {
			this._startProbe();
		}}>
              Run probe
            </button>`}
      </div>
      ${this._renderProbeState()}
    </section>`;
	}
	_renderProbeState() {
		let e = this._probe;
		switch (e.status) {
			case "idle": return E;
			case "running": return C`<div class="progress" aria-live="polite">
          <p class="now">Testing your cameras… this can take several minutes with an NVR.</p>
          ${e.log.length ? C`<p class="muted small">Now: ${e.log.at(-1)}</p>` : E}
          <details>
            <summary class="small">Every step so far${N("chevronDown")}</summary>
            <ol class="log">
              ${e.log.map((e) => C`<li>${e}</li>`)}
            </ol>
          </details>
        </div>`;
			case "error": return C`<div class="banner error" role="alert">The probe stopped: ${e.message}</div>`;
			case "done": return C`<div class="done">
          <p>
            <strong>Done.</strong> The file was saved as <code>${e.filename}</code>. Attach it to your
            report. If your browser or the Companion app blocked the download, copy it instead.
          </p>
          <div class="actions">
            <button @click=${() => {
				Ti(e.report, e.filename);
			}}>
              Download again
            </button>
            <button @click=${() => void this._copy(e.report)}>
              ${this._copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <details>
            <summary class="small">Show what is in the file${N("chevronDown")}</summary>
            <pre class="report">${JSON.stringify(e.report, null, 2)}</pre>
          </details>
        </div>`;
		}
	}
	_startProbe() {
		if (!this.hass) return;
		let e = [];
		this._copied = !1, this._probe = {
			status: "running",
			started: Date.now(),
			log: e
		};
		let t = He(this.hass, {
			include_battery: this._includeBattery,
			concurrency_test: this._concurrency,
			max_streams: this._maxStreams,
			playback_test: this._playback,
			playback_only: this._playback && this._playbackOnly,
			playback_concurrency_test: this._playback && this._playbackConcurrency,
			playback_max_streams: this._playbackStreams,
			baichuan_test: this._baichuan
		}, (e) => {
			this._probe.status === "running" && (this._probe = {
				...this._probe,
				log: [...this._probe.log, e].slice(-8)
			});
		});
		this._run = t, t.result.then((e) => {
			if (this._run !== t) return;
			this._run = void 0;
			let n = Pi(/* @__PURE__ */ new Date());
			this._probe = {
				status: "done",
				report: e,
				filename: n
			}, Ti(e, n);
		}, (e) => {
			this._run === t && (this._run = void 0, this._probe = {
				status: "error",
				message: j(e).message
			});
		});
	}
	_cancelProbe() {
		let e = this._run;
		this._run = void 0, e?.cancel(), this._probe = { status: "idle" };
	}
	async _copy(e) {
		try {
			await navigator.clipboard.writeText(JSON.stringify(e, null, 2)), this._copied = !0;
		} catch {
			this._copied = !1;
		}
	}
	static styles = [
		Kt,
		L,
		o`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--rv-ground);
        color: var(--rv-text);
        -webkit-font-smoothing: antialiased;
      }
      /* The band: where you are, and the time. */
      .band {
        display: flex;
        align-items: stretch;
        gap: 24px;
        height: 64px;
        padding: 0 20px;
        background: var(--rv-rail);
        color: var(--rv-on-rail);
        box-sizing: border-box;
        flex: none;
      }
      ha-menu-button {
        align-self: center;
      }
      .title {
        display: flex;
        align-items: center;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      nav {
        display: flex;
      }
      .tab {
        min-height: 0;
        padding: 0 14px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: var(--rv-on-rail-muted);
        font-size: 16px;
        box-shadow: inset 0 -3px 0 transparent;
      }
      .tab:hover:not(:disabled) {
        background: transparent;
        color: var(--rv-on-rail);
      }
      .tab[aria-current] {
        color: var(--rv-on-rail);
        box-shadow: inset 0 -3px 0 var(--rv-on-rail);
      }
      .tab:focus-visible {
        outline-color: var(--rv-on-rail);
        outline-offset: -6px;
      }
      .clock {
        margin-left: auto;
        align-self: center;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
      }
      :host([narrow]) .band {
        flex-wrap: wrap;
        height: auto;
        gap: 0;
        padding: 0 16px 0 4px;
      }
      :host([narrow]) .title {
        height: 56px;
        font-size: 20px;
        padding-left: 8px;
      }
      :host([narrow]) nav {
        order: 3;
        width: 100%;
        height: 44px;
      }
      :host([narrow]) .tab {
        flex: 1;
        font-size: 15px;
      }
      :host([narrow]) .clock {
        font-size: 24px;
      }
      main {
        flex: 1;
        min-width: 0;
      }
      /* Focused by the panel after a change of view, not by the user: no ring. */
      main:focus {
        outline: none;
      }
      /* Over the board and the events, when neither can work. */
      .wide-note {
        max-width: 760px;
        padding: 24px;
      }
      :host([narrow]) .wide-note {
        padding: 14px 16px;
      }
      /* Reolink Viewer cannot reach the cameras: why, what still works, what to do. */
      .integration {
        padding: 18px 20px;
        background: var(--rv-ground-2);
      }
      .integration.fault {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .integration h2 {
        margin: 0 0 6px;
        font-family: var(--rv-font-cond);
        font-size: 24px;
        font-weight: 600;
        line-height: 1.15;
      }
      .integration p {
        margin: 0 0 8px;
        max-width: 64ch;
      }
      .integration .what {
        font-weight: 600;
      }
      .integration .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 20px;
        margin-top: 4px;
      }
      .integration .check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .integration.fault a {
        color: var(--rv-on-fault);
      }
      .integration.fault .check {
        border-color: var(--rv-on-fault);
        color: var(--rv-on-fault);
      }
      .integration .check svg {
        width: 18px;
        height: 18px;
      }
      .integration details {
        margin-top: 12px;
        font-size: 13px;
      }
      .integration summary {
        cursor: pointer;
        font-weight: 500;
      }
      .integration .technical {
        display: block;
        margin-top: 4px;
        font-family: var(--rv-mono);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      main.page {
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        padding: 20px 24px 40px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      :host([narrow]) main.page {
        padding: 14px 16px 32px;
      }
      main.page > * {
        min-width: 0;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 28px;
        font-weight: 600;
        line-height: 1.1;
      }
      .heading {
        display: flex;
        align-items: baseline;
        gap: 16px;
      }
      .back {
        padding-left: 0;
      }
      .checks {
        list-style: none;
        margin: 10px 0 12px;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      .checks li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .checks .row {
        display: flex;
        align-items: center;
        gap: 16px;
        width: 100%;
        min-height: 64px;
        padding: 10px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .checks a.row {
        text-decoration: none;
      }
      .checks .row:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .checks .row:focus-visible {
        outline-offset: -2px;
      }
      .checks .what {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .checks .name {
        font-size: 17px;
        font-weight: 600;
      }
      .checks .row svg {
        flex: none;
        width: 18px;
        height: 18px;
        color: var(--rv-muted);
      }
      .card > p {
        margin: 6px 0;
      }
      .options {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 12px 0 14px;
      }
      .options select {
        margin: -4px 4px 0;
        padding: 2px 6px;
      }
      .progress .now {
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .progress,
      .done {
        margin-top: 14px;
      }
      .done .actions {
        margin: 10px 0;
      }
      .log {
        margin: 6px 0 0;
        padding-left: 22px;
        color: var(--rv-muted);
        font-family: var(--rv-mono);
        font-size: 13px;
      }
      .toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: min(560px, calc(100vw - 32px));
        padding: 8px 8px 8px 16px;
        background: var(--rv-board);
        color: var(--rv-on-board);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
      }
      .toast.error {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .toast .dismiss {
        min-height: 0;
        padding: 6px;
        border: none;
        background: transparent;
        color: inherit;
      }
    `
	];
};
customElements.get("reolink-viewer-panel") || customElements.define("reolink-viewer-panel", Bi);
//#endregion
export { R as $, Zr as A, lt as At, U as B, $e as Bt, ii as C, Be as Ct, qr as D, pt as Dt, ci as E, Ke as Et, q as F, Xe as Ft, V as G, j as Gt, ir as H, dt as Ht, kr as I, nt as It, Hn as J, E as Jt, $n as K, Qe as Kt, fr as L, We as Lt, si as M, it as Mt, Wr as N, rt as Nt, ui as O, at as Ot, Kr as P, Ze as Pt, xn as Q, ar as R, Ue as Rt, li as S, et as St, Q as T, Le as Tt, er as U, _t as Ut, or as V, ft as Vt, nr as W, gt as Wt, kn as X, o as Xt, jn as Y, C as Yt, An as Z, ni as _, Dt as _t, ji as a, I as at, ri as b, N as bt, wi as c, F as ct, J as d, jt as dt, gn as et, X as f, Nt as ft, Gr as g, Tt as gt, Jr as h, wt as ht, Ai as i, L as it, Ur as j, ct as jt, Xr as k, st as kt, Ci as l, P as lt, Qr as m, At as mt, $ as n, on as nt, Ni as o, Vt as ot, fi as p, Et as pt, tr as q, A as qt, Fi as r, sn as rt, Si as s, Bt as st, Bi as t, un as tt, Hr as u, St as ut, pi as v, kt as vt, $r as w, Re as wt, ti as x, Ve as xt, di as y, Mt as yt, W as z, tt as zt };
