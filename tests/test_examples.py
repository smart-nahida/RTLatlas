"""Check teaching projects elaborate and their self-checking TBs pass on real RTL."""
import json, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from parse_rtl import parse_project
ROOT = Path(__file__).resolve().parents[1]
NAMES = ['counter', 'clock_divider', 'shift_register', 'pwm', 'edge_detector',
         'sync_fifo', 'pipeline_mac', 'ready_valid_buffer', 'traffic_light', 'simple_ram', 'uart_loopback', 'spi_registers', 'stream_fir',
         'packet_router', 'dma_engine', 'tiny_cpu']

class TeachingExamplesTest(unittest.TestCase):
    def test_projects_elaborate_without_testbench_roots(self):
        for name in NAMES:
            with self.subTest(project=name):
                project = parse_project(str(ROOT / 'examples' / name))
                self.assertEqual(project['roots'], ['top'])
                self.assertGreater(len(project['instances']['top']['graph']['nodes']), 0)
                self.assertNotIn('tb', project['instances'])
                if name in NAMES[-6:]:
                    self.assertGreaterEqual(len(project['instances']), 4, 'advanced examples need real module hierarchy')

    @unittest.skipUnless(shutil.which('iverilog') and shutil.which('vvp'), 'Icarus Verilog required')
    def test_real_simulations_pass_and_produce_vcd(self):
        for name in NAMES:
            with self.subTest(project=name), tempfile.TemporaryDirectory(prefix='atlas-lesson-') as tmp:
                root = ROOT / 'examples' / name
                config = json.loads((root / 'simulation.json').read_text())
                binary = Path(tmp) / 'simulation.vvp'
                subprocess.run(['iverilog', '-g2012', '-s', config['top'], '-o', str(binary),
                                *[str(root / f) for f in config['sources']]], check=True, capture_output=True, timeout=30)
                result = subprocess.run(['vvp', str(binary)], cwd=tmp, check=True, capture_output=True, text=True, timeout=10)
                self.assertIn('PASS', result.stdout)
                wave = Path(tmp) / config['waveform']
                self.assertGreater(wave.stat().st_size, 100)
                subprocess.run(['node', '--input-type=module', '-e',
                    "import fs from 'node:fs';import {parseVcd} from './shared/waveform.mjs';const w=parseVcd(fs.readFileSync(process.argv[1],'utf8'));if(w.signals.length<3||w.endTime<=0)process.exit(1);", str(wave)],
                    cwd=ROOT, check=True, capture_output=True, timeout=10)
