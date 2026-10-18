import unittest
from types import SimpleNamespace
from validation import production_checks
class Checks(unittest.TestCase):
    def row(self,key,punch,weight='',size=100):
        return (SimpleNamespace(key=key,category='player',tier='impact-heavy',stage='impact',weight=weight),0,dict(punch=punch,bytes=size),[])
    def test_size(self): self.assertTrue(any('1MB' in x for x in production_checks([self.row('x',0,size=1000001)],None)))
    def test_spread(self): self.assertTrue(any('冲击差' in x for x in production_checks([self.row('a',0),self.row('b',-4)],None)))
    def test_hierarchy(self): self.assertTrue(any('层级' in x for x in production_checks([self.row('player/a',0,'core'),self.row('player/b',0,'filler')],None)))
    def test_pass(self): self.assertEqual(production_checks([self.row('player/a',0,'core'),self.row('player/b',-2,'filler')],None),[])
if __name__=='__main__': unittest.main()
