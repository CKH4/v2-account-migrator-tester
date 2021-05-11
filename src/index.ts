import { AccountMigrator } from "v2-account-migrator"
import { MigratorEvents } from "v2-account-migrator/src/events"
import { hexToBytes } from "v2-account-migrator/ts-client-library/packages/util/src/hex"

const formEl = document.body.appendChild(document.createElement("form"))
const labelEl = formEl.appendChild(document.createElement("label"))
const labelTextEl = labelEl.appendChild(document.createElement("span"))
labelTextEl.textContent = "Account Handle"
const inputEl = labelEl.appendChild(document.createElement("input"))
const submitEl = formEl.appendChild(document.createElement("button"))
submitEl.textContent = "Migrate"
submitEl.type = "submit"

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
	const containerEl = document.body.appendChild(document.createElement("div"))
	const statusEl = containerEl.appendChild(document.createElement("h1"))
	const detailsEl = containerEl.appendChild(document.createElement("h2"))

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
	})

	await migrator.migrate()
}
