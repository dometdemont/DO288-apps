package controller

import (
	"hpe5g-operator/pkg/controller/hpe5gapp"
)

func init() {
	// AddToManagerFuncs is a list of functions to create controllers and add them to a manager.
	AddToManagerFuncs = append(AddToManagerFuncs, hpe5gapp.Add)
}
