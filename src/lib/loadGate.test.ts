/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLoadGate } from './loadGate.ts'

test('loadGate - leitura sem escrita no caminho vale', () => {
  const gate = createLoadGate()
  assert.equal(gate.startLoad()(), true)
})

test('loadGate - só a carga mais recente vale', () => {
  const gate = createLoadGate()
  const antiga = gate.startLoad()
  const nova = gate.startLoad()
  assert.equal(antiga(), false)
  assert.equal(nova(), true)
})

test('loadGate - leitura iniciada antes de uma escrita é descartada, mesmo com a escrita em andamento', () => {
  const gate = createLoadGate()
  const leitura = gate.startLoad()
  const fim = gate.startWrite()
  assert.equal(leitura(), false)
  fim()
  assert.equal(leitura(), false)
})

test('loadGate - leitura iniciada durante a escrita é descartada antes e depois do fim dela', () => {
  const gate = createLoadGate()
  const fim = gate.startWrite()
  const leitura = gate.startLoad()
  assert.equal(leitura(), false)
  fim()
  assert.equal(leitura(), false)
})

test('loadGate - leitura iniciada depois da escrita terminar vale', () => {
  const gate = createLoadGate()
  gate.startWrite()()
  assert.equal(gate.startLoad()(), true)
})
