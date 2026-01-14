import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EntityFormComponent } from './entity-form/entity-form';

const routes: Routes = [
  {
    path: '',
    component: EntityFormComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GeneratorRoutingModule { }
