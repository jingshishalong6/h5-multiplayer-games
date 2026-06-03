process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  if (chunk.includes('uci')) process.stdout.write('id name Fake Pikafish\nuciok\n');
  if (chunk.includes('isready')) process.stdout.write('readyok\n');
  if (chunk.includes('go ')) process.stdout.write('info depth 20 score cp 88\nbestmove b2b9\n');
  if (chunk.includes('quit')) process.exit(0);
});
