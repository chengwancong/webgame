// The historical three-build experiment is explicit and never release acceptance.
if(process.argv.includes('--legacy'))await import('./balance-legacy.ts');
else {if(!process.argv[2]||process.argv[2].startsWith('--'))process.argv[2]='docs/reviews/build-variety-r8-20261006/final-balance';await import('./measure-build-variety.ts');}
