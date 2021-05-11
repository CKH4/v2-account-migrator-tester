import { AccountMigrator } from "v2-account-migrator"
import { MigratorEvents } from "v2-account-migrator/src/events"
import { hexToBytes } from "v2-account-migrator/ts-client-library/packages/util/src/hex"

const appEl = document.body.appendChild(document.createElement("div"))
appEl.style.fontFamily = "monospace"
const formEl = appEl.appendChild(document.createElement("form"))
const inputContainerEl = formEl.appendChild(document.createElement("div"))
const labelEl = inputContainerEl.appendChild(document.createElement("label"))
const labelTextEl = labelEl.appendChild(document.createElement("div"))
labelTextEl.textContent = "Account Handle"
const inputEl = labelEl.appendChild(document.createElement("input"))
const submitEl = formEl.appendChild(document.createElement("button"))
submitEl.textContent = "Migrate"
submitEl.type = "submit"
const containerEl = appEl.appendChild(document.createElement("div"))
const statusEl = containerEl.appendChild(document.createElement("h1"))
const detailsEl = containerEl.appendChild(document.createElement("h2"))
const logEl = appEl.appendChild(document.createElement("div"))

formEl.addEventListener("submit", (e) => {
	e.preventDefault()

	inputEl.disabled = true
	submitEl.disabled = true

	const accountHandle = hexToBytes(inputEl.value)

	if (accountHandle.length == 64) {
		runMigrator(accountHandle)
	}
})

const runMigrator = async (accountHandle: Uint8Array) => {
	const migrator = new AccountMigrator(
		accountHandle,
		{
			storageNodeV1: "https://broker-1.opacitynodes.com:3000",
			storageNodeV2: "https://beta-broker.opacitynodes.com:3000",
		}
	)

	migrator.addEventListener(MigratorEvents.STATUS, (s: any) => {
		console.log("Status:", s.detail.status)
		statusEl.textContent = s.detail.status
	})

	migrator.addEventListener(MigratorEvents.DETAILS, (d: any) => {
		console.info("Details:", d.detail.details)
		detailsEl.textContent = d.detail.details
	})

	migrator.addEventListener(MigratorEvents.WARNING, (w: any) => {
		console.warn("Warning:", w.detail.warning)

		const warningEl = logEl.appendChild(document.createElement("div"))
		warningEl.style.backgroundColor = "lemonchiffon"
		warningEl.style.padding = "4px"
		warningEl.style.margin = "4px"
		warningEl.textContent = "Warning! " + w.detail.warning
	})

	migrator.addEventListener(MigratorEvents.ERROR, (w: any) => {
		console.warn("Error (this may result in data loss!):", w.detail.error)

		const errorEl = logEl.appendChild(document.createElement("div"))
		errorEl.style.backgroundColor = "orangered"
		errorEl.style.padding = "4px"
		errorEl.style.margin = "4px"
		errorEl.textContent = "Error! (this may result in data loss!) " + w.detail.error
	})

	await migrator.migrate()
}
