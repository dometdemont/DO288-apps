/*
Copyright 2021.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// HPE5gcsAppSpec defines the desired state of HPE5gcsApp
type HPE5gcsAppSpec struct {
	TemplateName string `json:"templateName"`
	TemplateURL  string `json:"templateURL"`
}

// HPE5gcsAppStatus defines the observed state of HPE5gcsApp
type HPE5gcsAppStatus struct {
	Feedback string `json:"feedback"`
	Ready    bool   `json:"ready"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status

// HPE5gcsApp is the Schema for the hpe5gcsapps API
type HPE5gcsApp struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   HPE5gcsAppSpec   `json:"spec,omitempty"`
	Status HPE5gcsAppStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// HPE5gcsAppList contains a list of HPE5gcsApp
type HPE5gcsAppList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []HPE5gcsApp `json:"items"`
}

func init() {
	SchemeBuilder.Register(&HPE5gcsApp{}, &HPE5gcsAppList{})
}
