package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	templatev1 "github.com/openshift/api/template/v1"
)

// EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!
// NOTE: json tags are required.  Any new fields you add must have json tags for the fields to be serialized.

// HPE5gAppSpec defines the desired state of HPE5gApp
type HPE5gAppSpec struct {
	TemplateName string `json:"templateName"`
	TemplateContent templatev1.Template `json:"templateContent"`
}

// HPE5gAppStatus defines the observed state of HPE5gApp
type HPE5gAppStatus struct {
	Feedback string `json:"feedback"`
	Ready  bool `json:"ready"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// HPE5gApp is the Schema for the hpe5gapps API
// +kubebuilder:subresource:status
// +kubebuilder:resource:path=hpe5gapps,scope=Namespaced
type HPE5gApp struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   HPE5gAppSpec   `json:"spec,omitempty"`
	Status HPE5gAppStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// HPE5gAppList contains a list of HPE5gApp
type HPE5gAppList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []HPE5gApp `json:"items"`
}

func init() {
	SchemeBuilder.Register(&HPE5gApp{}, &HPE5gAppList{})
}
